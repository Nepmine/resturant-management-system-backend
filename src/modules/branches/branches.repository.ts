import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const branchRepository = {
  async findAll(restaurantId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.branch.findMany({
      where: { restaurantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(branchId: number, restaurantId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.branch.findFirst({
      where: { id: branchId, restaurantId, deletedAt: null },
    });
  },

  async findByIdOnly(branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.branch.findFirst({
      where: { id: branchId, deletedAt: null },
    });
  },

  async countActive(restaurantId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.branch.count({
      where: { restaurantId, deletedAt: null },
    });
  },

  async create(
    data: {
      restaurantId: number;
      name: string;
      address?: string;
      phone?: string;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.branch.create({ data });
  },

  async update(
    branchId: number,
    data: { name?: string; address?: string; phone?: string },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.branch.update({ where: { id: branchId }, data });
  },

  async setActive(branchId: number, isActive: boolean, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.branch.update({ where: { id: branchId }, data: { isActive } });
  },

  async softDelete(branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.branch.update({
      where: { id: branchId },
      data: { deletedAt: new Date() },
    });
  },
};
