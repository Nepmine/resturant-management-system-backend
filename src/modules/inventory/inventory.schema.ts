import { z } from 'zod';
import { paginationQuery } from '../../middleware/validate';

export const invBranchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});

export const invItemParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    itemId: z.coerce.number().int().positive(),
  }),
});

export const invCategoryParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive(),
  }),
});

export const createInvCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(80),
    sortOrder: z.number().int().min(0).default(0),
  }),
});

export const updateInvCategorySchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(80).optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' }),
});

export const createInventoryItemSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    unit: z.string().min(1).max(50),
    categoryId: z.number().int().positive().optional(),
    quantity: z.number().min(0).default(0),
    lowStockThreshold: z.number().min(0).default(0),
  }),
});

export const updateInventoryItemSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(150).optional(),
      unit: z.string().min(1).max(50).optional(),
      categoryId: z.number().int().positive().nullable().optional(),
      lowStockThreshold: z.number().min(0).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' }),
});

export const adjustStockSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    itemId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    changeType: z.enum(['add', 'remove', 'adjust']),
    quantityDelta: z.number().nonzero(),
    note: z.string().max(500).optional(),
  }),
});

export const inventoryLogsQuerySchema = z.object({
  query: paginationQuery,
});
