import { z } from 'zod';

export const categoryBranchParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
});

export const categoryParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive(),
  }),
});

export const createCategorySchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().min(0).default(0),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const reorderCategoriesSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    // Array of { id, sortOrder } pairs — bulk update
    order: z
      .array(
        z.object({
          id: z.number().int().positive(),
          sortOrder: z.number().int().min(0),
        }),
      )
      .min(1),
  }),
});
