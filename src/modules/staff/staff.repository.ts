import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const staffRepository = {
  async findAll(
    restaurantId: number,
    pagination: { skip: number; take: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    const where = { restaurantId, deletedAt: null };
    const [rows, total] = await Promise.all([
      db.staffUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.staffUser.count({ where }),
    ]);
    return { rows, total };
  },

  async findById(staffId: number, restaurantId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.staffUser.findFirst({
      where: { id: staffId, restaurantId, deletedAt: null },
    });
  },

  async findByEmail(email: string, restaurantId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.staffUser.findFirst({
      where: { email, restaurantId, deletedAt: null },
    });
  },

  async create(
    data: {
      restaurantId: number;
      name: string;
      email: string;
      role: string;
      branchId?: number | null;
      oauthProvider: string;
      oauthId: string;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.staffUser.create({ data: { isActive: false, ...data } as any });
  },

  async setActive(staffId: number, isActive: boolean, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.staffUser.update({ where: { id: staffId }, data: { isActive } });
  },

  async updateRole(
    staffId: number,
    data: { role: string; branchId?: number | null },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.staffUser.update({ where: { id: staffId }, data: data as any });
  },

  async softDelete(staffId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.staffUser.update({
      where: { id: staffId },
      data: { isActive: false, deletedAt: new Date() },
    });
  },

  async findLogs(
    staffId: number,
    pagination: { skip: number; take: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    const where = { staffId };
    const [rows, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.activityLog.count({ where }),
    ]);
    return { rows, total };
  },
};
