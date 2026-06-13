import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/validate.ts
// Zod-based request validation middleware.
// Validates req.body, req.query, and/or req.params against a provided schema.
// On failure, responds with a 422 + structured error details matching §H1.
//
// Usage in routes.ts:
//   router.post('/orders', validate(createOrderSchema), ordersController.create);
//
// Schema convention (per §A1b):
//   Each module has an orders.schema.ts (colocated with orders.dto.ts).
//   The Zod schema is the single source for both runtime validation and
//   TypeScript types via z.infer<typeof schema>.
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestSchemas {
  /** Schema for req.body */
  body?: ZodSchema;
  /** Schema for req.query — note: all query params arrive as strings */
  query?: ZodSchema;
  /** Schema for req.params */
  params?: ZodSchema;
}

/**
 * Returns an Express middleware that validates the request against the
 * provided Zod schemas. Calls next() on success, responds 422 on failure.
 *
 * @param schemas  An object with optional body, query, and params schemas.
 *
 * The validated (and coerced) data replaces the original req.body /
 * req.query / req.params so downstream code always receives typed values.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (err) {
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
      next(err);
    }
  };
}

// ── Common reusable schemas ───────────────────────────────────────────────────
// Import these in module schema files to avoid duplication.

/** Integer path parameter (e.g. :id, :branchId) */
export const intIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

/** Branch ID path parameter */
export const branchIdParam = z.object({
  branchId: z.coerce.number().int().positive(),
});

/** Session ID path parameter */
export const sessionIdParam = z.object({
  sessionId: z.coerce.number().int().positive(),
});

/** Order ID path parameter */
export const orderIdParam = z.object({
  orderId: z.coerce.number().int().positive(),
});

/** Standard pagination query schema */
export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * Date-range analytics query — accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * or ?period=today|week|month|year
 */
export const analyticsDateQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  period: z.enum(['today', 'week', 'month', 'year']).optional(),
});

/** ?updatedAfter=<ISO> for incremental polling endpoints */
export const updatedAfterQuery = z.object({
  updatedAfter: z.string().datetime({ offset: true }).optional(),
});
