import { z } from 'zod';

export const analyticsBranchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});

export const analyticsRestaurantParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

/** Shared period query — all analytics endpoints accept this. */
export const periodQuerySchema = z.object({
  query: z.object({
    // Either a named period OR explicit from/to dates
    period: z.enum(['today', 'week', 'month', 'year']).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }).refine(
    (d) => d.period || (d.from && d.to) || (!d.period && !d.from && !d.to),
    { message: 'Provide either period or from+to, not a mix' },
  ),
});
