import { z } from 'zod';

export const subscriptionRestaurantParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const upgradeSubscriptionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    plan: z.enum(['monthly', 'yearly']),
    maxBranches: z.number().int().min(1).max(50),
    // expiresAt: absolute expiry the admin/billing sets on upgrade
    expiresAt: z.string().datetime({ offset: true }),
  }),
});

export const cancelSubscriptionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});
