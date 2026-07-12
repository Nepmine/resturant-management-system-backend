import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { logoutSchema } from './auth.schema';
import * as authController from './auth.controller';

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/auth/auth.routes.ts
// Mounts auth endpoints under the /auth prefix.
// Registered in app.ts as: app.use('/api/v1/auth', authRouter)
//
// §D1 endpoint map:
//   GET  /auth/google              Public  → redirect to Google OAuth
//   GET  /auth/google/callback     Public  → OAuth callback, issue tokens
//   POST /auth/refresh             Cookie  → rotate refresh token
//   POST /auth/logout              Bearer  → revoke refresh token
//   GET  /auth/me                  Bearer  → current user profile
//   GET  /me/permissions           Staff+  → flat permission object
//
// NOTE: GET /me/permissions is mounted at app level as /api/v1/me/permissions
//       (not under /auth) per the spec. See comment at bottom.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── OAuth CSRF protection via state cookie ────────────────────────────────────
//
// We use `session: false` (stateless JWT architecture), which means Passport
// cannot use its built-in session-based state store. Instead we implement a
// lightweight cookie-based state flow:
//
//   1. /google route — generate a random nonce, set it as a short-lived
//      httpOnly cookie, and pass it to Google as the `state` query param.
//   2. /google/callback — before Passport runs, verify that req.query.state
//      matches the cookie, then clear the cookie.
//
// SameSite=Lax is required on the state cookie so that the browser sends it
// when Google redirects back (a top-level cross-site GET).
// ─────────────────────────────────────────────────────────────────────────────

const OAUTH_STATE_COOKIE = '_oauth_state';

/** Step 1: Generate state nonce, store in cookie, attach to req for passport. */
function setOAuthState(req: Request, res: Response, next: NextFunction): void {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',            // lax = sent on top-level cross-site GET (redirect from Google)
    maxAge: 5 * 60 * 1000,     // 5 minutes — enough for the OAuth round-trip
    path: '/api/v1/auth/google',
  });
  (req as any)._oauthState = state;
  next();
}

/** Step 2: Verify state nonce from cookie matches what Google returned. */
function verifyOAuthState(req: Request, res: Response, next: NextFunction): void {
  const cookieState: string | undefined = req.cookies?.[OAUTH_STATE_COOKIE];
  const queryState = req.query['state'] as string | undefined;

  // Always clear the state cookie — one use only.
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth/google' });

  if (!cookieState || !queryState || cookieState !== queryState) {
    res.redirect(`${env.FRONTEND_URL}/auth/error?code=INVALID_STATE`);
    return;
  }

  next();
}

// ── GET /auth/google ──────────────────────────────────────────────────────────
// Public — initiates the Google OAuth flow.
// Sets the state cookie, then passport.authenticate() appends ?state=<nonce>
// to the Google authorization URL.
router.get(
  '/google',
  authLimiter,
  setOAuthState,
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      session: false,
      scope: ['profile', 'email'],
      state: (req as any)._oauthState,
    })(req, res, next);
  },
);

// ── GET /auth/google/callback ─────────────────────────────────────────────────
// Public — Google redirects here after the user grants consent.
// verifyOAuthState runs first (CSRF check), then Passport verifies the profile.
// On success: Passport calls done(null, staff) → req.user is set → controller runs.
// On failure: Passport redirects to failureRedirect.
router.get(
  '/google/callback',
  authLimiter,
  verifyOAuthState,
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/auth/error?code=NOT_WHITELISTED`,
  }),
  asyncHandler(authController.googleCallback),
);

// ── POST /auth/refresh ────────────────────────────────────────────────────────
// Accepts refresh token from HttpOnly cookie OR from request body.
// No Bearer token required — this is how a new access token is obtained
// when the old one expires.
router.post(
  '/refresh',
  authLimiter,
  asyncHandler(authController.refresh),
);

// ── POST /auth/logout ─────────────────────────────────────────────────────────
// Requires valid access token (Bearer).
// Body: { everywhere?: boolean } — if true, revokes all tokens for this staff.
router.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  asyncHandler(authController.logoutHandler),
);

// ── GET /auth/me ──────────────────────────────────────────────────────────────
// Requires valid access token. Returns full staff profile.
// Does NOT go through resolveTenant — profile is available even if
// subscription has lapsed (staff need to see their account info).
router.get(
  '/me',
  asyncHandler(authenticate),
  asyncHandler(authController.me),
);

export { router as authRouter };

// ─────────────────────────────────────────────────────────────────────────────
// GET /me/permissions is mounted separately in app.ts at the /api/v1 level:
//
//   app.get(
//     '/api/v1/me/permissions',
//     authenticate,
//     resolveTenant,
//     authorize('staff'),
//     authController.permissions,
//   );
//
// This is intentional — /me/permissions requires an active subscription
// (resolveTenant) because the frontend uses it to gate subscription-dependent
// features. The /auth/me endpoint does NOT require an active subscription so
// staff can always see their own profile.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standalone /me/permissions handler — exported for direct mounting in app.ts.
 *
 * Usage in app.ts:
 *   import { permissionsRoute } from './modules/auth/auth.routes';
 *   app.get('/api/v1/me/permissions', ...permissionsRoute);
 */
export const permissionsRoute = [
  asyncHandler(authenticate),
  resolveTenant,
  authorize('staff'),
  authController.permissions,
] as const;
