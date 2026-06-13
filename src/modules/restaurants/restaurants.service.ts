import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { restaurantRepository } from './restaurants.repository';
import type { CreateRestaurantDto, UpdateRestaurantDto, RestaurantDto } from './restaurants.dto';

function formatRestaurant(r: {
  id: number;
  name: string;
  address: string | null;
  billingEmail: string | null;
  createdAt: Date;
  subscriptions?: Array<{
    plan: string;
    status: string;
    expiresAt: Date | null;
    graceExpiresAt: Date | null;
  }>;
}): RestaurantDto {
  const sub = r.subscriptions?.[0];
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    billingEmail: r.billingEmail,
    createdAt: r.createdAt,
    ...(sub && {
      subscription: {
        plan: sub.plan,
        status: sub.status,
        expiresAt: sub.expiresAt,
        graceExpiresAt: sub.graceExpiresAt,
      },
    }),
  };
}

export const restaurantService = {
  /**
   * POST /restaurants (public)
   * Creates the restaurant + a trial subscription atomically.
   * Trial: no expiry set — expireSubscriptions job handles lifecycle.
   */
  async create(dto: CreateRestaurantDto): Promise<RestaurantDto> {
    return prisma.$transaction(async (tx) => {
      const restaurant = await restaurantRepository.create(
        {
          name: dto.name,
          address: dto.address,
          billingEmail: dto.billingEmail,
        },
        tx,
      );

      // Auto-create trial subscription — max 1 branch, no expiry initially
      await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          plan: 'trial',
          status: 'active',
          maxBranches: 1,
          startedAt: new Date(),
        },
      });

      return formatRestaurant(restaurant);
    });
  },

  async getById(id: number): Promise<RestaurantDto> {
    const restaurant = await restaurantRepository.findByIdWithSubscription(id);
    if (!restaurant) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');
    return formatRestaurant(restaurant as any);
  },

  async update(id: number, dto: UpdateRestaurantDto): Promise<RestaurantDto> {
    const existing = await restaurantRepository.findById(id);
    if (!existing) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');

    const updated = await restaurantRepository.update(id, dto);
    return formatRestaurant(updated);
  },

  async softDelete(id: number): Promise<void> {
    const existing = await restaurantRepository.findById(id);
    if (!existing) throw new AppError('Restaurant not found', 404, 'NOT_FOUND');
    await restaurantRepository.softDelete(id);
  },
};
