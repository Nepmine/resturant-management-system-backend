import { z } from 'zod';
import { paginationQuery, updatedAfterQuery } from '../../middleware/validate';

export const sessionBranchParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
});

export const sessionParamSchema = z.object({
  params: z.object({
    sessionId: z.coerce.number().int().positive(),
  }),
});

export const activeSessionsQuerySchema = z.object({
  query: paginationQuery.merge(updatedAfterQuery),
});
