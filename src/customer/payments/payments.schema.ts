import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  body: z.object({
    method: z.enum(['cash', 'esewa']),
    // optional: pay specific orders only; empty = full session balance
    orderIds: z.array(z.number().int().positive()).optional(),
  }),
});

export const esewaInitiateSchema = z.object({
  body: z.object({
    // optional order scoping — same semantics as above
    orderIds: z.array(z.number().int().positive()).optional(),
    successUrl: z.string().url(),
    failureUrl: z.string().url(),
  }),
});
