import { z } from 'zod';

export const sessionInvoiceParamSchema = z.object({
  params: z.object({
    sessionId: z.coerce.number().int().positive(),
  }),
});

export const orderInvoiceParamSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
});
