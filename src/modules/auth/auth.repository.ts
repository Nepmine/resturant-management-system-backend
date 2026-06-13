import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/auth/auth.repository.ts
// Thin Prisma wrappers for auth-related DB operations.
// NO business logic here — that lives exclusively in auth.service.ts.
// All methods that can be called inside a transaction accept an optional
// `tx` parameter (Prisma.TransactionClient).
// ─────────────────────────────────────────────────────────────────────────────

type TxClient = Prisma.TransactionClient;

// ── Staff lookups ─────────────────────────────────────────────────────────────

/**
 * Full staff row with restaurant + branch — used after OAuth success
 * and when building the /auth/me response.
 */
export async function findStaffById(id: number, tx?: TxClient) {
  const client = tx ?? prisma;
  return client.staffUser.findFirst({
    where: { id, deletedAt: null },
    include: {
      restaurant: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, isActive: true } },
    },
  });
}

/**
 * Lightweight staff row for is_active + role checks inside middleware.
 */
export async function findActiveStaffById(
  id: number,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.staffUser.findFirst({
    where: { id, isActive: true, deletedAt: null },
    select: {
      id: true,
      restaurantId: true,
      branchId: true,
      role: true,
      isActive: true,
    },
  });
}

// ── Refresh tokens ────────────────────────────────────────────────────────────

/**
 * Insert a new refresh token row.
 * Called immediately after issuing a new token pair.
 */
export async function createRefreshToken(
  data: {
    staffId: number;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  },
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.refreshToken.create({ data });
}

/**
 * Find a refresh token by its SHA-256 hash.
 * Returns null if not found (handles missing key gracefully).
 */
export async function findRefreshTokenByHash(
  tokenHash: string,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  try {
    return await client.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        staff: {
          select: {
            id: true,
            restaurantId: true,
            branchId: true,
            role: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

/**
 * Revoke a single refresh token (soft-revoke via revokedAt timestamp).
 * Used on normal rotation — old token is revoked, new token is issued.
 */
export async function revokeRefreshToken(
  tokenHash: string,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke ALL tokens in a token family.
 * Used on:
 *   1. Reuse detection — someone presented an old token from this family,
 *      meaning the current valid token may be compromised → kill the family.
 *   2. POST /auth/logout?everywhere=true — user explicitly logs out everywhere.
 */
export async function revokeTokenFamily(
  familyId: string,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all active refresh tokens for a staff member.
 * Used on account suspension (PATCH /staff/:id/suspend).
 */
export async function revokeAllStaffTokens(
  staffId: number,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.refreshToken.updateMany({
    where: { staffId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Delete expired refresh tokens older than `olderThan`.
 * Called by a cleanup job periodically (not implemented in v1 but ready).
 */
export async function deleteExpiredRefreshTokens(
  olderThan: Date,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.refreshToken.deleteMany({
    where: { expiresAt: { lt: olderThan } },
  });
}

// ── Login history ─────────────────────────────────────────────────────────────

/**
 * Record a login attempt (successful or failed).
 * For failed attempts, staffId may be null and attemptedEmail is populated.
 */
export async function recordLoginAttempt(
  data: {
    staffId: number | null;
    attemptedEmail?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    success: boolean;
  },
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.loginHistory.create({
    data: {
      staffId: data.staffId,
      attemptedEmail: data.attemptedEmail ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      success: data.success,
    },
  });
}

/**
 * Record the logout time on the most recent successful login entry.
 */
export async function recordLogout(staffId: number, tx?: TxClient) {
  const client = tx ?? prisma;
  // Update the most recent login entry that doesn't already have a logoutAt
  const latest = await client.loginHistory.findFirst({
    where: { staffId, success: true, logoutAt: null },
    orderBy: { loginAt: 'desc' },
    select: { id: true },
  });
  if (!latest) return;
  return client.loginHistory.update({
    where: { id: latest.id },
    data: { logoutAt: new Date() },
  });
}

/**
 * Fetch login history for a staff member (for GET /staff/:id/logs).
 */
export async function getLoginHistory(
  staffId: number,
  limit = 20,
  tx?: TxClient,
) {
  const client = tx ?? prisma;
  return client.loginHistory.findMany({
    where: { staffId },
    orderBy: { loginAt: 'desc' },
    take: limit,
    select: {
      id: true,
      loginAt: true,
      logoutAt: true,
      ipAddress: true,
      userAgent: true,
      success: true,
    },
  });
}