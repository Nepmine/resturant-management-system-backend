import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const kitchenRepository = {
  /**
   * Active orders for KDS view — confirmed, preparing, or ready.
   * Optionally filtered by updatedAfter for incremental polling.
   */
  async findActiveOrders(branchId: number, updatedAfter?: Date, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: { in: ['confirmed', 'preparing', 'ready'] },
        ...(updatedAfter && { updatedAt: { gt: updatedAfter } }),
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
        },
        session: {
          select: {
            table: {
              select: {
                tableNumber: true,
                section: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // oldest first in kitchen
    });
  },

  /**
   * Queue: orders with at least one pending or preparing item.
   * Used by the kitchen display for "what to cook next".
   */
  async findQueueOrders(branchId: number, updatedAfter?: Date, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: { in: ['confirmed', 'preparing'] },
        items: {
          some: {
            status: { in: ['pending', 'preparing'] },
            deletedAt: null,
          },
        },
        ...(updatedAfter && { updatedAt: { gt: updatedAfter } }),
      },
      include: {
        items: {
          where: {
            deletedAt: null,
            status: { in: ['pending', 'preparing'] },
          },
          orderBy: { id: 'asc' },
        },
        session: {
          select: {
            table: { select: { tableNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findItemById(itemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.orderItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: { order: { select: { id: true, branchId: true, status: true } } },
    });
  },
};
