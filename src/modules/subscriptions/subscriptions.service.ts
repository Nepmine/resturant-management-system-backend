import { env } from '../../config/env';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { restaurantRepository } from '../restaurants/restaurants.repository';
import { subscriptionRepository } from './subscriptions.repository';
import type { UpgradeSubscriptionDto, CancelSubscriptionDto, SubscriptionDto } from './subscriptions.dto';

function formatSubscription(s: {
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
}): SubscriptionDto {
  return {
    id: s.id,
    restaurantId: s.restaurantId,
    plan: s.plan,
    status: s.status,
    maxBranches: s.maxBranches,
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
    graceExpiresAt: s.graceExpiresAt,
    cancelledAt: s.cancelledAt,
    createdAt: s.createdAt,
  };
}

export const subscriptionService = {
  async getActive(restaurantId: number): Promise<SubscriptionDto> {
    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');

    const sub = await subscriptionRepository.findActiveByRestaurantId(restaurantId);
    if (!sub) throw new AppError('No active subscription', 404, 'NOT_FOUND');

    return formatSubscription(sub as any);
  },

  /**
   * Upgrade plan — marks current subscription cancelled, creates a new one.
   * Calculates grace_expires_at = expiresAt + SUBSCRIPTION_GRACE_DAYS.
   */
  async upgrade(restaurantId: number, dto: UpgradeSubscriptionDto): Promise<SubscriptionDto> {
    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const current = await subscriptionRepository.findActiveByRestaurantId(restaurantId, tx);

      // Cancel previous subscription if exists
      if (current) {
        await subscriptionRepository.update(
          (current as any).id,
          { status: 'cancelled', cancelledAt: new Date() },
          tx,
        );
      }

      const expiresAt = new Date(dto.expiresAt);
      const graceExpiresAt = new Date(expiresAt);
      graceExpiresAt.setDate(graceExpiresAt.getDate() + env.SUBSCRIPTION_GRACE_DAYS);

      const newSub = await subscriptionRepository.create(
        {
          restaurantId,
          plan: dto.plan,
          status: 'active',
          maxBranches: dto.maxBranches,
          startedAt: new Date(),
          expiresAt,
        },
        tx,
      );

      // Set grace expiry
      const updated = await subscriptionRepository.update(
        newSub.id,
        { graceExpiresAt },
        tx,
      );

      return formatSubscription(updated as any);
    });
  },

  async cancel(restaurantId: number, _dto: CancelSubscriptionDto): Promise<SubscriptionDto> {
    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const sub = await subscriptionRepository.findActiveByRestaurantId(restaurantId, tx);
      if (!sub) throw new AppError('No active subscription to cancel', 400, 'NO_ACTIVE_SUBSCRIPTION');

      const updated = await subscriptionRepository.update(
        (sub as any).id,
        { status: 'cancelled', cancelledAt: new Date() },
        tx,
      );

      return formatSubscription(updated as any);
    });
  },

  async getBillingHistory(restaurantId: number): Promise<SubscriptionDto[]> {
    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');

    const subs = await subscriptionRepository.findAllByRestaurantId(restaurantId);
    return subs.map(formatSubscription);
  },
};
