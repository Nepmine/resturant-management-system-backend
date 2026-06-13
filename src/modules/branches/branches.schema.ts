import { z } from 'zod';

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    address: z.string().max(500).optional(),
    phone: z.string().max(20).optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().max(20).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' },
  ),
});

export const branchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});
