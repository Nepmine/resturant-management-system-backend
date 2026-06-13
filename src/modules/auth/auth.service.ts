import crypto from 'crypto';
import { StaffRole, StaffUser } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import {
  signAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  expiryDateFromDuration,
} from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';
import {
  findStaffById,
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeAllStaffTokens,
  recordLoginAttempt,
  recordLogout,
} from './auth.repository';
import type {
  TokenPairDto,
  StaffProfileDto,
  AuthCallbackDto,
  PermissionsDto,
  RefreshResponseDto,
} from './auth.dto';

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/auth/auth.service.ts
// All auth business logic and transaction boundaries.
// Controllers call exactly one method here — no logic in controllers.
// ─────────────────────────────────────────────────────────────────────────────

// How long (in seconds) until an access token expires — derived from env string
// e.g. "15m" → 900
function accessTokenExpiresInSeconds(): number {
  const raw = env.JWT_ACCESS_EXPIRES_IN;
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const n = parseInt(match[1]);
  const unit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (unit[match[2]] ?? 60);
}

// ── Core token pair issuance ──────────────────────────────────────────────────

/**
 * Issues a new access + refresh token pair for a staff member.
 * Persists the hashed refresh token to refresh_tokens.
 * All writes happen inside a transaction so a DB failure never
 * produces a token that isn't tracked.
 *
 * @param staffId    The staff member's DB id
 * @param familyId   UUID for the login session family. Pass an existing
 *                   familyId on rotation; pass crypto.randomUUID() on new login.
 */
async function issueTokenPair(
  staffId: number,
  restaurantId: number,
  branchId: number | null,
  role: StaffRole,
  familyId: string,
): Promise<TokenPairDto> {
  return prisma.$transaction(async (tx) => {
    const accessToken = signAccessToken({ sub: staffId, restaurantId, branchId, role });

    const { raw: refreshRaw, hash: refreshHash } = generateRefreshToken(staffId, familyId);

    await createRefreshToken(
      {
        staffId,
        familyId,
        tokenHash: refreshHash,
        expiresAt: expiryDateFromDuration(env.JWT_REFRESH_EXPIRES_IN),
      },
      tx,
    );

    return {
      accessToken,
      refreshToken: refreshRaw,
      expiresIn: accessTokenExpiresInSeconds(),
    };
  });
}

// ── handleOAuthLogin ──────────────────────────────────────────────────────────

/**
 * Called from the Google OAuth callback handler after Passport has verified
 * the profile and confirmed the staff is whitelisted (§C4).
 *
 * Responsibilities:
 *   1. Record the login in login_history
 *   2. Issue a fresh token pair with a new familyId (new login session)
 *   3. Return combined user profile + tokens
 */
export async function handleOAuthLogin(
  staff: StaffUser & {
    restaurant: { id: number; name: string };
    branch: { id: number; name: string; isActive: boolean } | null;
  },
  ipAddress: string | null,
  userAgent: string | null,
): Promise<AuthCallbackDto> {
  const familyId = crypto.randomUUID();

  // Issue tokens and record login in parallel-safe way (login_history is
  // fire-and-forget for audit purposes — its failure should not break login).
  const [tokens] = await Promise.all([
    issueTokenPair(staff.id, staff.restaurantId, staff.branchId, staff.role, familyId),
    recordLoginAttempt({
      staffId: staff.id,
      ipAddress,
      userAgent,
      success: true,
    }).catch((e) => console.error('[auth] recordLoginAttempt failed:', e)),
  ]);

  return {
    user: mapStaffToProfileDto(staff),
    tokens,
  };
}

// ── refreshTokens ─────────────────────────────────────────────────────────────

/**
 * Rotates a refresh token (§H3 — family tracking).
 *
 * Algorithm:
 *   1. Verify JWT signature and expiry
 *   2. Hash the raw token and look it up in the DB
 *   3a. Token is already revoked → REUSE DETECTED → revoke entire family, throw 401
 *   3b. Token not found → tampered / never issued → throw 401
 *   4. Token is valid and not revoked → revoke old token, issue new pair (same familyId)
 *
 * Family tracking ensures that if a stolen token is used after the legitimate
 * user has already rotated it, the attacker's use triggers family invalidation,
 * forcing a re-login for both parties and alerting to the compromise.
 */
export async function refreshTokens(
  rawRefreshToken: string,
): Promise<RefreshResponseDto & { refreshToken: string }> {
  // 1. Verify JWT structure and signature first (fast, no DB hit)
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    throw new AppError(
      isExpired ? 'Refresh token has expired. Please log in again.' : 'Invalid refresh token.',
      401,
      isExpired ? 'REFRESH_TOKEN_EXPIRED' : 'INVALID_REFRESH_TOKEN',
    );
  }

  const tokenHash = hashToken(rawRefreshToken);

  return prisma.$transaction(async (tx) => {
    // 2. Find the token record
    const tokenRow = await findRefreshTokenByHash(tokenHash, tx);

    if (!tokenRow) {
      // Token hash not in DB — either tampered or from a different environment.
      throw new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }

    // 3a. Reuse detection — token exists but is already revoked
    if (tokenRow.revokedAt !== null) {
      // Someone is replaying a revoked token. This means either:
      //   - The legitimate user's new token was stolen, OR
      //   - An attacker got the old token and is trying to use it
      // Either way → kill the entire family immediately.
      await revokeTokenFamily(tokenRow.familyId, tx);
      throw new AppError(
        'Refresh token reuse detected. All sessions have been invalidated. Please log in again.',
        401,
        'REFRESH_TOKEN_REUSE',
      );
    }

    // 3b. Check token expiry at DB level (belt-and-suspenders; JWT already checked above)
    if (tokenRow.expiresAt < new Date()) {
      await revokeRefreshToken(tokenHash, tx);
      throw new AppError('Refresh token has expired. Please log in again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // 4. Validate the staff member is still active
    const { staff } = tokenRow;
    if (!staff.isActive || staff.deletedAt !== null) {
      await revokeTokenFamily(tokenRow.familyId, tx);
      throw new AppError('Account has been suspended.', 401, 'ACCOUNT_SUSPENDED');
    }

    // 5. Rotate — revoke old token, issue new pair in same family
    await revokeRefreshToken(tokenHash, tx);

    const accessToken = signAccessToken({
      sub: staff.id,
      restaurantId: staff.restaurantId,
      branchId: staff.branchId,
      role: staff.role,
    });

    const { raw: newRefreshRaw, hash: newRefreshHash } = generateRefreshToken(
      staff.id,
      tokenRow.familyId, // same family — preserve login session continuity
    );

    await createRefreshToken(
      {
        staffId: staff.id,
        familyId: tokenRow.familyId,
        tokenHash: newRefreshHash,
        expiresAt: expiryDateFromDuration(env.JWT_REFRESH_EXPIRES_IN),
      },
      tx,
    );

    return {
      accessToken,
      refreshToken: newRefreshRaw,
      expiresIn: accessTokenExpiresInSeconds(),
    };
  });
}

// ── logout ────────────────────────────────────────────────────────────────────

/**
 * Revokes the current refresh token (or all tokens if `everywhere` = true).
 * Records the logout time in login_history.
 */
export async function logout(
  staffId: number,
  rawRefreshToken: string | undefined,
  everywhere: boolean,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (everywhere) {
      await revokeAllStaffTokens(staffId, tx);
    } else if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await revokeRefreshToken(tokenHash, tx);
    }
    await recordLogout(staffId, tx);
  });
}

// ── getMe ────────────────────────────────────────────────────────────────────

/**
 * Returns the full profile for the currently authenticated staff member.
 */
export async function getMe(staffId: number): Promise<StaffProfileDto> {
  const staff = await findStaffById(staffId);
  if (!staff) {
    throw new AppError('Staff account not found', 404, 'NOT_FOUND');
  }
  return mapStaffToProfileDto(staff);
}

// ── getPermissions ────────────────────────────────────────────────────────────

/**
 * Returns a flat permission object for frontend route/button gating (§C5).
 * Shape is derived entirely from StaffRole — no DB query needed beyond
 * what authenticate() already did.
 */
export function getPermissions(role: StaffRole): PermissionsDto {
  const isStaff = true; // all authenticated staff have staff-level access
  const isManager = role === 'manager' || role === 'admin';
  const isAdmin = role === 'admin';

  return {
    // ── Read ──────────────────────────────────────────────────────────────
    canViewOrders: isStaff,
    canViewSessions: isStaff,
    canViewPayments: isStaff,
    canViewInvoices: isStaff,
    canViewInventory: isStaff,
    canViewAnalytics: isManager,
    canViewStaff: isAdmin,
    canViewBills: isManager,
    canViewFeedback: isManager,

    // ── Write ─────────────────────────────────────────────────────────────
    canManageMenu: isManager,
    canManageTables: isManager,
    canManageSections: isManager,
    canManageInventory: isManager,
    canManageBills: isManager,
    canManageBranches: isAdmin,
    canManageStaff: isAdmin,
    canManageSubscription: isAdmin,
    canManageRestaurant: isAdmin,

    // ── Actions ───────────────────────────────────────────────────────────
    canConfirmOrders: isStaff,
    canUpdateOrderItems: isStaff,
    canAcknowledgeWaiterRequests: isStaff,
    canProcessRefunds: isManager,
    canCloseSession: isStaff,
    canRegenerateQr: isManager,
    canSuspendStaff: isAdmin,

    role,
  };
}

// ── Mapper ───────────────────────────────────────────────────────────────────

function mapStaffToProfileDto(
  staff: StaffUser & {
    restaurant: { id: number; name: string };
    branch: { id: number; name: string; isActive?: boolean } | null;
  },
): StaffProfileDto {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    isActive: staff.isActive,
    restaurant: {
      id: staff.restaurant.id,
      name: staff.restaurant.name,
    },
    branch: staff.branch
      ? { id: staff.branch.id, name: staff.branch.name }
      : null,
    createdAt: staff.createdAt,
  };
}