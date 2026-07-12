import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const waiterRequestRepository = {
  async findByBranch(
    branchId: number,
    filters: { status?: string; updatedAfter?: Date },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.waiterRequest.findMany({
      where: {
        branchId,
        ...(filters.status && { status: filters.status as any }),
        ...(filters.updatedAfter && { createdAt: { gt: filters.updatedAfter } }),
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(requestId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.waiterRequest.findUnique({ where: { id: requestId } });
  },

  async findBySession(sessionId: number, updatedAfter?: Date, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.waiterRequest.findMany({
      where: {
        sessionId,
        ...(updatedAfter && { createdAt: { gt: updatedAfter } }),
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(data: { sessionId: number; type: string }, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.waiterRequest.create({ data: { ...data, status: 'pending' } as any });
  },

  async acknowledge(requestId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.waiterRequest.update({
      where: { id: requestId },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
  },

  async resolve(requestId: number, staffId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.waiterRequest.update({
      where: { id: requestId },
      data: { status: 'resolved', resolvedById: staffId, resolvedAt: new Date() },
    });
  },
};
