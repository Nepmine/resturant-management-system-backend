import { z } from 'zod';

export const tableBranchParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
});

export const tableParamSchema = z.object({
  params: z.object({
    tableId: z.coerce.number().int().positive(),
  }),
});

export const tableListQuerySchema = z.object({
  query: z.object({
    sectionId: z.coerce.number().int().positive().optional(),
    status: z.enum(['available', 'occupied', 'cleaning']).optional(),
  }),
});

export const createTableSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    sectionId: z.coerce.number().int().positive(),
    tableNumber: z.number().int().min(1),
    label: z.string().max(50).optional(),
  }),
});

export const updateTableSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    tableId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      // Only tableNumber and label are updatable via generic PATCH.
      // Status is NEVER updated here — use dedicated transition endpoints.
      tableNumber: z.number().int().min(1).optional(),
      label: z.string().max(50).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'At least one field must be provided',
    }),
});

// Params for routes that live under /tables/:tableId (root-level, not nested)
export const tableRootParamSchema = z.object({
  params: z.object({
    tableId: z.coerce.number().int().positive(),
  }),
});

// Nested param — used for branch-scoped table routes when branchId is also present
export const tableNestedParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    tableId: z.coerce.number().int().positive(),
  }),
});
