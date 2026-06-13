import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import {
  verifyAccessToken,
  extractBearerToken,
} from '../utils/jwt';
import { AppError } from './errorHandler';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/auth.ts
// Staff JWT authentication middleware.
//
// CRITICAL RULE (§AUTH ISOLATION, §H3):
//   is_active MUST be re-checked on every request — not just at login.
//   This ensures suspended staff lose access immediately without waiting for
//   their token to expire (tokens last 15 min; suspension must take effect now).
//
// Pipeline position: FIRST in all protected staff route chains.
//   authenticate() → resolveTenant() → authorize(role) → validate() → handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the Authorization: Bearer <accessToken> header.
 * Decodes the JWT, re-checks staff.is_active in the DB, and populates req.user.
 *
 * Fails with 401 if:
 *   - No / malformed Authorization header
 *   - JWT signature is invalid or token is expired
 *   - Staff row not found (deleted after token issued)
 *   - Staff is_active = false (suspended after token issued)
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  let payload: ReturnType<typeof verifyAccessToken>;

  try {
    payload = verifyAccessToken(token);
  } catch (err: unknown) {
    const isExpired =
      err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      error: isExpired ? 'Token has expired' : 'Invalid token',
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
    return;
  }

  // Re-check is_active on every request — do NOT rely solely on the JWT claim.
  // If a staff member is suspended, this check makes it effective immediately.
  const staff = await prisma.staffUser.findFirst({
    where: {
      id: payload.sub,
      deletedAt: null,
    },
    select: {
      id: true,
      isActive: true,
      restaurantId: true,
      branchId: true,
      role: true,
    },
  });

  if (!staff) {
    res.status(401).json({
      success: false,
      error: 'Staff account not found',
      code: 'ACCOUNT_NOT_FOUND',
    });
    return;
  }

  if (!staff.isActive) {
    res.status(401).json({
      success: false,
      error: 'Account has been suspended',
      code: 'ACCOUNT_SUSPENDED',
    });
    return;
  }

  // Attach typed user to request — downstream middleware and handlers use this
  req.user = {
    sub: staff.id,
    restaurantId: staff.restaurantId,
    branchId: staff.branchId,
    role: staff.role,
    jti: payload.jti,
  };

  next();
}

/**
 * Optional authentication — same as authenticate() but does NOT fail if no
 * token is present. Used for endpoints that can serve both authenticated and
 * anonymous users (currently none in v1, but exported for future use).
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const staff = await prisma.staffUser.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      select: {
        id: true,
        isActive: true,
        restaurantId: true,
        branchId: true,
        role: true,
      },
    });
    if (staff) {
      req.user = {
        sub: staff.id,
        restaurantId: staff.restaurantId,
        branchId: staff.branchId,
        role: staff.role,
        jti: payload.jti,
      };
    }
  } catch {
    // Ignore errors — token is invalid/expired but this middleware is optional
  }

  next();
}