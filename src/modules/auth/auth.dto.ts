import { StaffRole } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// src/modules/auth/auth.dto.ts
// TypeScript interfaces for auth module request/response shapes.
// ─────────────────────────────────────────────────────────────────────────────

// ── Token pair ────────────────────────────────────────────────────────────────

export interface TokenPairDto {
  /** Short-lived JWT (15m) — sent in response body */
  accessToken: string;
  /**
   * Long-lived JWT (7d) — also set as HttpOnly cookie.
   * Included in body for mobile clients that cannot use cookies.
   */
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

// ── Staff profile (GET /auth/me) ──────────────────────────────────────────────

export interface StaffProfileDto {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  restaurant: {
    id: number;
    name: string;
  };
  branch: {
    id: number;
    name: string;
  } | null;
  createdAt: Date;
}

// ── OAuth callback response ───────────────────────────────────────────────────

export interface AuthCallbackDto {
  user: StaffProfileDto;
  tokens: TokenPairDto;
}

// ── Permissions object (GET /me/permissions) ──────────────────────────────────
// Flat permission object for frontend route/button gating (§C5).
// Shape is driven by StaffRole — higher roles include lower roles' permissions.

export interface PermissionsDto {
  // ── Read permissions ────────────────────────────────────────────────────
  canViewOrders: boolean;
  canViewSessions: boolean;
  canViewPayments: boolean;
  canViewInvoices: boolean;
  canViewInventory: boolean;
  canViewAnalytics: boolean;
  canViewStaff: boolean;
  canViewBills: boolean;
  canViewFeedback: boolean;

  // ── Write permissions ───────────────────────────────────────────────────
  canManageMenu: boolean;        // manager+
  canManageTables: boolean;      // manager+
  canManageSections: boolean;    // manager+
  canManageInventory: boolean;   // manager+
  canManageBills: boolean;       // manager+
  canManageBranches: boolean;    // admin only
  canManageStaff: boolean;       // admin only
  canManageSubscription: boolean; // admin only
  canManageRestaurant: boolean;   // admin only

  // ── Action permissions ──────────────────────────────────────────────────
  canConfirmOrders: boolean;     // staff+
  canUpdateOrderItems: boolean;  // staff+ (KDS)
  canAcknowledgeWaiterRequests: boolean; // staff+
  canProcessRefunds: boolean;    // manager+
  canCloseSession: boolean;      // staff+
  canRegenerateQr: boolean;      // manager+
  canSuspendStaff: boolean;      // admin only

  // ── Meta ────────────────────────────────────────────────────────────────
  role: StaffRole;
}

// ── Refresh response ──────────────────────────────────────────────────────────

export interface RefreshResponseDto {
  accessToken: string;
  expiresIn: number;
}

// ── Login history entry ───────────────────────────────────────────────────────

export interface LoginHistoryEntryDto {
  id: string;
  loginAt: Date;
  logoutAt: Date | null;
  ipAddress: string | null;
  success: boolean;
}
