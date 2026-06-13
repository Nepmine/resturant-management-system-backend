import { z } from 'zod';

export const dashboardBranchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});
