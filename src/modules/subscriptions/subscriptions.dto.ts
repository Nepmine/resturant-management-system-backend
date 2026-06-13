import { z } from 'zod';
import { upgradeSubscriptionSchema, cancelSubscriptionSchema } from './subscriptions.schema';

export type UpgradeSubscriptionDto = z.infer<typeof upgradeSubscriptionSchema>['body'];
export type CancelSubscriptionDto = z.infer<typeof cancelSubscriptionSchema>['body'];

export interface SubscriptionDto {
  id: number;
  restaurantId: number;
  plan: string;
  status: string;
  maxBranches: number;
  startedAt: Date;
  expiresAt: Date | null;
  graceExpiresAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}
