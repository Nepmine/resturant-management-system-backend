import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const sectionRepository = {
  async findAll(branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.section.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async findById(sectionId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.section.findFirst({
      where: { id: sectionId, branchId, deletedAt: null },
    });
  },

  async create(
    data: { branchId: number; name: string; sortOrder?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.section.create({ data: { sortOrder: 0, ...data } });
  },

  async update(
    sectionId: number,
    data: { name?: string; sortOrder?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.section.update({ where: { id: sectionId }, data });
  },

  async softDelete(sectionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.section.update({
      where: { id: sectionId },
      data: { deletedAt: new Date() },
    });
  },

  /** Check whether any non-deleted tables still reference this section. */
  async hasActiveTables(sectionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    const count = await db.table.count({
      where: { sectionId, deletedAt: null },
    });
    return count > 0;
  },
};
