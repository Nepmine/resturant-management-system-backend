import { z } from 'zod';
import { updatedAfterQuery } from '../../middleware/validate';

export const waiterRequestBranchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});

export const waiterRequestParamSchema = z.object({
  params: z.object({ requestId: z.coerce.number().int().positive() }),
});

export const waiterRequestListQuerySchema = z.object({
  query: updatedAfterQuery.extend({
    status: z.enum(['pending', 'acknowledged', 'resolved']).optional(),
  }),
});

// Staff acknowledge / resolve — no body needed
export const resolveWaiterRequestSchema = z.object({
  params: z.object({ requestId: z.coerce.number().int().positive() }),
});

// Customer submit
export const submitWaiterRequestSchema = z.object({
  body: z.object({
    type: z.enum(['call_waiter', 'request_water', 'request_tissue']),
  }),
});
