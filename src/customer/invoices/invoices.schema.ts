import { z } from 'zod';

export const customerOrderInvoiceParamSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
});
