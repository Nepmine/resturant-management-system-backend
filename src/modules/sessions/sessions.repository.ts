import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

const sessionInclude = {
  table: {
    select: {
      id: true,
      tableNumber: true,
      label: true,
      section: { select: { name: true } },
    },
  },
  members: {
    select: { id: true, name: true, phone: true, joinedAt: true },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.DiningSessionInclude;

export const sessionRepository = {
  async findActive(branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.diningSession.findMany({
      where: { branchId, status: 'active' },
      include: sessionInclude,
      orderBy: { startedAt: 'asc' },
    });
  },

  async findById(sessionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.diningSession.findFirst({
      where: { id: sessionId },
      include: {
        ...sessionInclude,
        orders: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            payments: {
              where: { status: 'completed' },
              select: { amount: true },
            },
          },
        },
      },
    });
  },

  async findByIdAndBranch(sessionId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.diningSession.findFirst({
      where: { id: sessionId, branchId },
    });
  },

  async countMembers(sessionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.sessionMember.count({ where: { sessionId } });
  },

  async countNonCancelledOrders(sessionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.order.count({
      where: { sessionId, status: { not: 'cancelled' }, deletedAt: null },
    });
  },

  async close(
    sessionId: number,
    tx?: TxClient,
  ): Promise<{ id: number; tableId: number }> {
    const db = tx ?? prisma;
    return db.diningSession.update({
      where: { id: sessionId },
      data: { status: 'completed', completedAt: new Date() },
      select: { id: true, tableId: true },
    });
  },

  async abandon(sessionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.diningSession.update({
      where: { id: sessionId },
      data: { status: 'abandoned', completedAt: new Date() },
    });
  },
};
