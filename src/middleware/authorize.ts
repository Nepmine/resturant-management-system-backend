import { Request, Response, NextFunction } from 'express';
import { StaffRole } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/authorize.ts
// Role-based access control for staff routes.
//
// §C3 spec:
//   const ROLE_HIERARCHY = { staff: 1, manager: 2, admin: 3 };
//   Staff role: scoped to their assigned branch only
//
// Pipeline position: AFTER authenticate(), BEFORE validate() and handler.
//   authenticate() → resolveTenant() → authorize(role) → assertBranchAccess() → ...
// ─────────────────────────────────────────────────────────────────────────────

// ── Role hierarchy ────────────────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<StaffRole, number> = {
  staff: 1,
  manager: 2,
  admin: 3,
} as const;

export type RoleLevel = StaffRole;

// ── authorize() factory ───────────────────────────────────────────────────────

/**
 * Returns a middleware that requires the authenticated staff member's role
 * to be >= minRole in the hierarchy.
 *
 *   authorize('staff')   → staff | manager | admin  (Staff+)
 *   authorize('manager') → manager | admin           (Manager+)
 *   authorize('admin')   → admin only                (Admin)
 *
 * MUST run after authenticate() — requires req.user to be populated.
 *
 * Usage:
 *   router.post('/branches', authenticate, resolveTenant, authorize('admin'), handler);
 */
export function authorize(minRole: RoleLevel) {
  return function authorizeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role];
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        error: `This action requires ${minRole} privileges or higher`,
        code: 'INSUFFICIENT_ROLE',
      });
      return;
    }

    next();
  };
}

// ── assertBranchAccess ────────────────────────────────────────────────────────

/**
 * Staff-role members are scoped to their own branch and may not access other
 * branches. Managers and admins are not restricted by this guard.
 *
 * The branchId to validate can come from:
 *   1. req.params.branchId   — explicit branch URL param
 *   2. req.user.branchId     — implicit (branch-scoped routes without param)
 *
 * Guards:
 *   - staff role: req.user.branchId must match the resolved branchId
 *   - manager/admin: always pass through
 *
 * MUST run after authenticate() + authorize('staff') (or higher).
 *
 * Usage:
 *   router.get('/branches/:branchId/orders',
 *     authenticate, resolveTenant, authorize('staff'), assertBranchAccess,
 *     validate(...), ordersController.list,
 *   );
 */
export function assertBranchAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  // Managers and admins have cross-branch access — they skip this check.
  if (ROLE_HIERARCHY[req.user.role] >= ROLE_HIERARCHY['manager']) {
    return next();
  }

  // For staff role: must have a branch assignment.
  if (req.user.branchId === null) {
    res.status(403).json({
      success: false,
      error: 'Staff account has no branch assignment. Contact your administrator.',
      code: 'NO_BRANCH_ASSIGNED',
    });
    return;
  }

  // Determine the target branch from the URL param (if present).
  const paramBranchId = req.params.branchId
    ? parseInt(req.params.branchId, 10)
    : null;

  if (paramBranchId !== null && paramBranchId !== req.user.branchId) {
    res.status(403).json({
      success: false,
      error: 'Access denied — you can only access your own branch',
      code: 'BRANCH_ACCESS_DENIED',
    });
    return;
  }

  next();
}

// ── assertSameBranch ──────────────────────────────────────────────────────────

/**
 * More targeted version of assertBranchAccess for routes where the branch
 * is derived from a resource (e.g. order.branchId) rather than a URL param.
 * Used in service-layer checks rather than as route middleware.
 *
 * Call from inside a service when you have a DB-fetched resource:
 *
 *   enforceStaffBranchScope(req.user, order.branchId);
 *
 * Throws AppError(403) if the staff member cannot access that branch.
 */
export function enforceStaffBranchScope(
  user: Express.User,
  resourceBranchId: number,
): void {
  if (ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY['manager']) return;
  if (user.branchId !== resourceBranchId) {
    throw {
      statusCode: 403,
      code: 'BRANCH_ACCESS_DENIED',
      message: 'Access denied — resource belongs to a different branch',
    };
  }
}

// ── Convenience pre-composed guards ──────────────────────────────────────────
// Ready-made middleware arrays — import and spread into route definitions
// to reduce boilerplate.
//
// Usage:
//   import { Guards } from '../middleware/authorize';
//   router.get('/something', ...Guards.staff, handler);

import { authenticate } from './auth';
import { resolveTenant } from './tenant';

export const Guards = {
  /** Staff or higher — most permissive protected route */
  staff: [authenticate, resolveTenant, authorize('staff'), assertBranchAccess] as const,

  /** Manager or higher */
  manager: [authenticate, resolveTenant, authorize('manager')] as const,

  /** Admin only */
  admin: [authenticate, resolveTenant, authorize('admin')] as const,

  /**
   * Staff+ but WITHOUT assertBranchAccess — use when the route does not have
   * a :branchId param AND access scoping is done inside the service layer.
   */
  staffNoScope: [authenticate, resolveTenant, authorize('staff')] as const,
} as const;
