import { z } from 'zod';

export const sectionBranchParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
});

export const sectionParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    sectionId: z.coerce.number().int().positive(),
  }),
});

export const createSectionSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().min(0).default(0),
  }),
});

export const updateSectionSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    sectionId: z.coerce.number().int().positive(),
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
