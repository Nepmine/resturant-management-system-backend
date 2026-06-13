import { z } from 'zod';
import { updatedAfterQuery } from '../../middleware/validate';

export const kitchenBranchParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
});

export const kitchenQuerySchema = z.object({
  query: updatedAfterQuery,
});

export const orderItemParamSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
});
