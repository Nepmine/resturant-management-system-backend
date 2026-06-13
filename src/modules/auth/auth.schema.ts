import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/auth/auth.schema.ts
// Zod schemas for the auth module.
// These are the single source for both runtime validation and TypeScript types
// via z.infer<>. Imported by validate() middleware in routes.
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /auth/refresh ────────────────────────────────────────────────────────
// The refresh token arrives as an HttpOnly cookie named 'refreshToken'.
// No request body is needed — this schema validates there is no unexpected body.
export const refreshTokenSchema = {
  // No body schema needed — token is read from cookie by the service
};

// ── POST /auth/logout ─────────────────────────────────────────────────────────
// Staff sends Bearer access token in Authorization header.
// Optional body to specify logout-everywhere (revoke all sessions in family).
export const logoutSchema = {
  body: z.object({
    everywhere: z.boolean().optional().default(false),
  }),
};

// ── GET /auth/me ──────────────────────────────────────────────────────────────
// No input — authenticated via Bearer token in header.

// ── GET /me/permissions ───────────────────────────────────────────────────────
// No input — derives permissions from req.user.role.

// ── Inferred types ────────────────────────────────────────────────────────────
export type LogoutBody = z.infer<typeof logoutSchema.body>;
