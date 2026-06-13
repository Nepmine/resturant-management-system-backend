import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const restaurantRepository = {
  async findById(id: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.restaurant.findFirst({
      where: { id, deletedAt: null },
    });
  },

  async findByIdWithSubscription(id: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.restaurant.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscriptions: {
          where: {
            status: { in: ['active', 'grace_period'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  },

  async create(
    data: { name: string; address?: string; billingEmail?: string },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.restaurant.create({ data });
  },

  async update(
    id: number,
    data: { name?: string; address?: string; billingEmail?: string },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.restaurant.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.restaurant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
