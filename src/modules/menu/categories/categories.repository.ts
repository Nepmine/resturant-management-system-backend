import { Prisma } from '@prisma/client';
import prisma from '../../../config/database';

type TxClient = Prisma.TransactionClient;

export const categoryRepository = {
  async findAll(branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuCategory.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async findById(categoryId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuCategory.findFirst({
      where: { id: categoryId, branchId, deletedAt: null },
    });
  },

  async create(
    data: { branchId: number; name: string; sortOrder?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuCategory.create({ data: { sortOrder: 0, ...data } });
  },

  async update(
    categoryId: number,
    data: { name?: string; sortOrder?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuCategory.update({ where: { id: categoryId }, data });
  },

  /**
   * Bulk sortOrder update — runs all updates inside a single transaction.
   * Each pair is { id, sortOrder }; we validate ownership in the service layer.
   */
  async bulkUpdateSortOrder(
    items: Array<{ id: number; sortOrder: number }>,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return Promise.all(
      items.map((item) =>
        db.menuCategory.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  },

  async softDelete(categoryId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuCategory.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });
  },

  /** Returns true when the category still has non-deleted items. */
  async hasActiveItems(categoryId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    const count = await db.menuItem.count({
      where: { categoryId, deletedAt: null },
    });
    return count > 0;
  },
};
