import { z } from 'zod';

export const sessionPaymentsParamSchema = z.object({
  params: z.object({
    sessionId: z.coerce.number().int().positive(),
  }),
});

export const orderPaymentsParamSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
});

export const paymentParamSchema = z.object({
  params: z.object({
    paymentId: z.coerce.number().int().positive(),
  }),
});

export const refundSchema = z.object({
  params: z.object({
    paymentId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    amount: z.number().positive(),
    reason: z.string().min(1).max(500),
  }),
});

// eSewa webhook verification payload (§D10 / §F2)
export const esewaVerifySchema = z.object({
  body: z.object({
    // eSewa sends these fields on callback
    oid: z.string(),           // our payment PID
    amt: z.string(),           // amount as string
    refId: z.string(),         // eSewa transaction reference
  }),
});
