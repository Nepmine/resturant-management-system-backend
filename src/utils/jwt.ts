import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { StaffRole } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// src/utils/jwt.ts
// Two completely separate JWT contexts (§C1, §AUTH ISOLATION):
//
//   Staff tokens  — signed with JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
//   Member tokens — signed with JWT_MEMBER_SECRET
//
// The secrets MUST differ. Member tokens carry sessionId and can never be used
// to authenticate as staff (different secret + different payload shape).
// ─────────────────────────────────────────────────────────────────────────────

// ── Payload Interfaces ────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: number;              // staff_users.id
  restaurantId: number;
  branchId: number | null;
  role: StaffRole;
  jti: string;              // unique token id (for revocation if needed)
}

export interface RefreshTokenPayload {
  sub: number;              // staff_users.id
  familyId: string;         // UUID — shared across the same login session
  jti: string;
}

export interface MemberTokenPayload {
  sub: number;              // session_members.id
  sessionId: number;
  tableId: number;
  branchId: number;
  restaurantId: number;
}

// ── Staff Access Token ────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<AccessTokenPayload, 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

// ── Staff Refresh Token ────────────────────────────────────────────────────────

/**
 * Generate a raw refresh token string and its SHA-256 hash for DB storage.
 * The raw token is sent to the client (HttpOnly cookie).
 * Only the hash is persisted — so a DB leak cannot be used to impersonate users.
 */
export function generateRefreshToken(staffId: number, familyId: string): {
  raw: string;
  hash: string;
  payload: RefreshTokenPayload;
} {
  const jti = crypto.randomUUID();
  const raw = jwt.sign(
    { sub: staffId, familyId, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
  const hash = hashToken(raw);
  return { raw, hash, payload: { sub: staffId, familyId, jti } };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

// ── Member Token (Customer) ────────────────────────────────────────────────────

/**
 * Issued when a customer scans a QR code and joins a session (§E1).
 * Signed with JWT_MEMBER_SECRET — completely separate from staff auth.
 */
export function signMemberToken(payload: MemberTokenPayload): string {
  return jwt.sign(payload, env.JWT_MEMBER_SECRET, {
    expiresIn: env.JWT_MEMBER_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyMemberToken(token: string): MemberTokenPayload {
  return jwt.verify(token, env.JWT_MEMBER_SECRET) as MemberTokenPayload;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * SHA-256 hash of a raw token string.
 * Used to store refresh tokens without keeping the raw value in the DB.
 */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Extract the Bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Calculate the absolute expiry Date from a duration string like "7d", "15m".
 * Used when inserting refresh_tokens rows (expires_at field).
 */
export function expiryDateFromDuration(duration: string): Date {
  const now = Date.now();
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration string: ${duration}`);
  const value = parseInt(match[1]);
  const unit = match[2];
  const ms: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(now + value * ms[unit]);
}
