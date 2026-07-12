import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/errorHandler.ts
// Global error handler — MUST be registered last in app.ts (after all routes).
// Handles: AppError, Prisma known errors, ZodError, and generic unknowns.
// Shape follows §H1 error envelope:
//   { success: false, error: string, code: string, details?: [...] }
// ─────────────────────────────────────────────────────────────────────────────

// ── AppError ─────────────────────────────────────────────────────────────────

/**
 * The application's typed error class.
 * Throw this anywhere in service or middleware code — the global handler picks
 * it up and maps it to the correct HTTP status + code.
 *
 *   throw new AppError('Session not active', 400, 'SESSION_INACTIVE');
 */
export class AppError extends Error {
  constructor(
    public override readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
    // Restore prototype chain when compiled to ES5
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ── Well-known AppError factories ────────────────────────────────────────────

export const Errors = {
  notFound: (entity = 'Resource') =>
    new AppError(`${entity} not found`, 404, 'NOT_FOUND'),

  unauthorized: (msg = 'Unauthorized') =>
    new AppError(msg, 401, 'UNAUTHORIZED'),

  forbidden: (msg = 'Access denied') =>
    new AppError(msg, 403, 'FORBIDDEN'),

  conflict: (msg = 'Resource already exists') =>
    new AppError(msg, 409, 'CONFLICT'),

  badRequest: (msg: string) =>
    new AppError(msg, 400, 'BAD_REQUEST'),

  paymentRequired: (msg: string) =>
    new AppError(msg, 402, 'PAYMENT_REQUIRED'),

  overpayment: () =>
    new AppError('Payment amount exceeds balance due', 400, 'OVERPAYMENT'),

  sessionInactive: () =>
    new AppError('Dining session is not active', 400, 'SESSION_INACTIVE'),

  branchLimitReached: (max: number) =>
    new AppError(`Plan allows a maximum of ${max} branches`, 403, 'BRANCH_LIMIT_REACHED'),

  subscriptionExpired: () =>
    new AppError('Subscription has expired', 402, 'SUBSCRIPTION_EXPIRED'),

  itemUnavailable: () =>
    new AppError('One or more menu items are unavailable', 400, 'ITEM_UNAVAILABLE'),
} as const;

// ── Global error handler ──────────────────────────────────────────────────────

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Our own typed errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // 2. Zod validation errors — should not reach here normally (validate()
  //    middleware catches them first) but acts as a safety net.
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  // 3. Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          error: 'A record with these details already exists',
          code: 'CONFLICT',
        });
        return;

      case 'P2025':
        res.status(404).json({
          success: false,
          error: 'Record not found',
          code: 'NOT_FOUND',
        });
        return;

      case 'P2003':
        res.status(400).json({
          success: false,
          error: 'Referenced record does not exist',
          code: 'FOREIGN_KEY_VIOLATION',
        });
        return;

      case 'P2034':
        // Transaction conflict — safe to retry
        res.status(409).json({
          success: false,
          error: 'Transaction conflict, please retry',
          code: 'TRANSACTION_CONFLICT',
        });
        return;

      default:
        // Fall through to generic 500
        break;
    }
  }

  // 4. Prisma validation errors (malformed queries)
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: 'Database query validation failed',
      code: 'DB_VALIDATION_ERROR',
    });
    return;
  }

  // 5. JWT errors from jsonwebtoken — may reach here if not caught in middleware
  if (err instanceof Error && err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  if (err instanceof Error && err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token has expired',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  // 6. Generic unknown — log fully, respond minimally
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Async error wrapper — eliminates try/catch boilerplate in route handlers.
 * Express 4 does not automatically catch async errors.
 *
 * Generic over the request type so controllers narrowed to
 * AuthenticatedStaffRequest / AuthenticatedMemberRequest are accepted.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler<R extends Request = Request>(
  fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req as R, res, next).catch(next);
  };
}
