import { z } from 'zod';
import { paginationQuery } from '../../middleware/validate';

export const billBranchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});

export const billParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
    billId: z.coerce.number().int().positive(),
  }),
});

export const billListQuerySchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['unpaid', 'paid', 'overdue']).optional(),
  }),
});

export const createBillSchema = z.object({
  body: z.object({
    type: z.enum(['electricity', 'rent', 'water', 'internet', 'other']),
    amount: z.number().positive(),
    dueDate: z.string().date(),
    note: z.string().max(500).optional(),
  }),
});

export const updateBillSchema = z.object({
  body: z
    .object({
      amount: z.number().positive().optional(),
      dueDate: z.string().date().optional(),
      note: z.string().max(500).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' }),
});
