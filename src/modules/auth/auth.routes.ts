import { Router } from 'express';
import passport from 'passport';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../middleware/errorHandler';
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

// ── GET /auth/google ──────────────────────────────────────────────────────────
// Public — initiates the Google OAuth flow.
// passport.authenticate redirects the browser to Google's consent screen.
router.get(
  '/google',
  authLimiter,
  passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email'],
  }),
);

// ── GET /auth/google/callback ─────────────────────────────────────────────────
// Public — Google redirects here after the user grants consent.
// On success: Passport calls done(null, staff) → req.user is set → controller runs.
// On failure: Passport redirects to failureRedirect with flash message.
router.get(
  '/google/callback',
  authLimiter,
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error?code=NOT_WHITELISTED`,
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
