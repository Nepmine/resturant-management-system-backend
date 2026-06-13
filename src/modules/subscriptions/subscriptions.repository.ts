import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const subscriptionRepository = {
  /**
   * Returns the current active or grace-period subscription for a restaurant.
   * Uses FOR UPDATE locking when a transaction client is supplied — required
   * for the branch-limit guard to be race-condition safe.
   */
  async findActiveByRestaurantId(restaurantId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    if (tx) {
      // Raw query with FOR UPDATE inside a transaction
      const rows = await tx.$queryRaw<
        Array<{
          id: number;
          restaurant_id: number;
          plan: string;
          status: string;
          max_branches: number;
          started_at: Date;
          expires_at: Date | null;
          grace_expires_at: Date | null;
          cancelled_at: Date | null;
          created_at: Date;
        }>
      >`
        SELECT * FROM subscriptions
        WHERE restaurant_id = ${restaurantId}
          AND (
            status = 'active'
            OR (status = 'grace_period' AND grace_expires_at > now())
          )
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `;
      return rows[0] ?? null;
    }
    return db.subscription.findFirst({
      where: {
        restaurantId,
        OR: [
          { status: 'active' },
          {
            status: 'grace_period',
            graceExpiresAt: { gt: new Date() },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findAllByRestaurantId(restaurantId: number) {
    return prisma.subscription.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(
    data: {
      restaurantId: number;
      plan: string;
      status: string;
      maxBranches: number;
      startedAt?: Date;
      expiresAt?: Date | null;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.subscription.create({ data });
  },

  async update(
    id: number,
    data: Partial<{
      plan: string;
      status: string;
      maxBranches: number;
      expiresAt: Date | null;
      graceExpiresAt: Date | null;
      cancelledAt: Date | null;
    }>,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.subscription.update({ where: { id }, data });
  },
};
