import type { Request } from 'express';
import { StaffRole } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// src/types/express.d.ts
// Augments the Express Request type so that req.user, req.tenant, and
// req.member are fully typed throughout the application.
//
//   req.user   → populated by authenticate() middleware (staff JWT)
//   req.tenant → populated by resolveTenant() middleware (subscription check)
//   req.member → populated by memberAuth() middleware (customer JWT)
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface User {
      /** staff_users.id */
      sub: number;
      restaurantId: number;
      branchId: number | null;
      role: StaffRole;
      /** JWT ID — unique per token issuance */
      jti: string;
    }

    interface Request {
      /**
       * Populated by authenticate() middleware on every protected staff route.
       * Contains the decoded access token payload.
       */
      user?: User;

      /**
       * Populated by resolveTenant() middleware.
       * Contains restaurant + subscription context for tenant-scoped operations.
       */
      tenant?: {
        restaurantId: number;
        subscriptionStatus: 'active' | 'grace_period' | 'expired' | 'cancelled';
        maxBranches: number;
      };

      /**
       * Populated by memberAuth() middleware on every /customer/* route.
       * Contains the decoded member token payload from the QR scan flow.
       */
      member?: {
        /** session_members.id */
        sub: number;
        sessionId: number;
        tableId: number;
        branchId: number;
        restaurantId: number;
      };
    }
  }
}

// ── Convenience re-exports ─────────────────────────────────────────────────────
// These let service files import types from one place without reaching into
// jwt.ts for the payload shapes.
//
// Extending the imported `Request` (not the `Express.Request` namespace type)
// ensures params, body, query, headers, etc. are available on the narrowed type.

export type AuthenticatedStaffRequest = Request & {
  user: NonNullable<Express.Request['user']>;
  tenant: NonNullable<Express.Request['tenant']>;
};

export type AuthenticatedMemberRequest = Request & {
  member: NonNullable<Express.Request['member']>;
};

/** The decoded payload from the member JWT (set by memberAuth middleware). */
export type MemberTokenPayload = NonNullable<Express.Request['member']>;
