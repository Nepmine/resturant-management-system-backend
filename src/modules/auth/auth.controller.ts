import { Request, Response } from 'express';
import { env } from '../../config/env';
import {
  handleOAuthLogin,
  refreshTokens,
  logout,
  getMe,
  getPermissions,
} from './auth.service';
import { sendSuccess } from '../../utils/apiResponse';

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/auth/auth.controller.ts
// Thin layer: parse req → call service → return response.
// ZERO business logic here (§A1b: "Controllers hold zero business logic").
//
// Cookie strategy:
//   Refresh token is set as an HttpOnly, Secure, SameSite=Strict cookie
//   AND returned in the response body (for mobile clients that cannot use
//   cookies). The service reads the raw token from whichever source is present.
// ─────────────────────────────────────────────────────────────────────────────

const REFRESH_COOKIE = 'refreshToken';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  // 7 days in ms — matches JWT_REFRESH_EXPIRES_IN default
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

// ── GET /auth/google ──────────────────────────────────────────────────────────
// Handled entirely by Passport — no controller method needed.
// The route wires: passport.authenticate('google', { session: false }).

// ── GET /auth/google/callback ─────────────────────────────────────────────────

/**
 * Called after Passport verifies the Google profile and the staff whitelist
 * check passes. req.user is populated by Passport (it is the full StaffUser
 * row with restaurant + branch relations, set in passport.ts verify callback).
 */
export async function googleCallback(req: Request, res: Response): Promise<void> {
  // Passport attach the verified staff object to req.user via done(null, staff)
  // If verification failed, req.user is undefined — Passport redirects to
  // the failure URL before this handler runs, so we can assert non-null here.
  const staff = req.user as any; // Passport sets this; typed fully in passport.ts

  if (!staff) {
    res.redirect(
      `${env.FRONTEND_URL}/auth/error?code=NOT_WHITELISTED`,
    );
    return;
  }

  const ipAddress = extractIp(req);
  const userAgent = req.headers['user-agent'] ?? null;

  const result = await handleOAuthLogin(staff, ipAddress, userAgent);

  // Set refresh token in HttpOnly cookie for browser clients
  res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);

  // Redirect to frontend with access token in query string.
  // The frontend reads it once, stores in memory, then discards the URL param.
  const redirectUrl = new URL(`${env.FRONTEND_URL}/auth/callback`);
  redirectUrl.searchParams.set('accessToken', result.tokens.accessToken);
  redirectUrl.searchParams.set('expiresIn', String(result.tokens.expiresIn));

  res.redirect(redirectUrl.toString());
}

// ── POST /auth/refresh ────────────────────────────────────────────────────────

/**
 * Rotates the refresh token. Reads from cookie first, falls back to body.
 * Writes the new refresh token back to the cookie.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const rawToken: string | undefined =
    req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;

  if (!rawToken) {
    res.status(401).json({
      success: false,
      error: 'Refresh token is required',
      code: 'MISSING_REFRESH_TOKEN',
    });
    return;
  }

  const result = await refreshTokens(rawToken);

  // Rotate cookie
  res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);

  sendSuccess(res, {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
}

// ── POST /auth/logout ─────────────────────────────────────────────────────────

/**
 * Revokes the refresh token and clears the cookie.
 * If body.everywhere = true, revokes ALL tokens for this staff member.
 */
export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const staffId = req.user!.sub;
  const rawToken: string | undefined =
    req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  const everywhere: boolean = req.body?.everywhere ?? false;

  await logout(staffId, rawToken, everywhere);

  // Clear the cookie regardless
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });

  sendSuccess(res, {
    message: everywhere
      ? 'Logged out from all devices'
      : 'Logged out successfully',
  });
}

// ── GET /auth/me ──────────────────────────────────────────────────────────────

export async function me(req: Request, res: Response): Promise<void> {
  const profile = await getMe(req.user!.sub);
  sendSuccess(res, profile);
}

// ── GET /me/permissions ───────────────────────────────────────────────────────

export function permissions(req: Request, res: Response): void {
  const perms = getPermissions(req.user!.role);
  sendSuccess(res, perms);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? null;
}
