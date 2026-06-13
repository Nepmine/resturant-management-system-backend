import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const inventoryRepository = {
  // ─── Categories ──────────────────────────────────────────────────────────
  async findAllCategories(branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryCategory.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  },

  async findCategoryById(categoryId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryCategory.findFirst({
      where: { id: categoryId, branchId, deletedAt: null },
    });
  },

  async createCategory(data: { branchId: number; name: string; sortOrder?: number }, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryCategory.create({ data: { sortOrder: 0, ...data } });
  },

  async updateCategory(categoryId: number, data: { name?: string; sortOrder?: number }, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryCategory.update({ where: { id: categoryId }, data });
  },

  async softDeleteCategory(categoryId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryCategory.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });
  },

  // ─── Items ───────────────────────────────────────────────────────────────
  async findAllItems(branchId: number, lowStockOnly = false, tx?: TxClient) {
    const db = tx ?? prisma;
    if (lowStockOnly) {
      // Low stock: quantity <= lowStockThreshold (and threshold > 0 to avoid false positives)
      return (db as any).$queryRaw<any[]>`
        SELECT * FROM inventory_items
        WHERE branch_id = ${branchId}
          AND deleted_at IS NULL
          AND low_stock_threshold > 0
          AND quantity <= low_stock_threshold
        ORDER BY name ASC
      `;
    }
    return db.inventoryItem.findMany({
      where: { branchId, deletedAt: null },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
    });
  },

  async findItemById(itemId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryItem.findFirst({
      where: { id: itemId, branchId, deletedAt: null },
    });
  },

  async createItem(
    data: {
      branchId: number;
      categoryId?: number | null;
      name: string;
      unit: string;
      quantity?: number;
      lowStockThreshold?: number;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.inventoryItem.create({ data: { quantity: 0, lowStockThreshold: 0, ...data } as any });
  },

  async updateItem(
    itemId: number,
    data: { name?: string; unit?: string; categoryId?: number | null; lowStockThreshold?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.inventoryItem.update({ where: { id: itemId }, data: data as any });
  },

  async adjustQuantity(itemId: number, delta: number, tx?: TxClient) {
    const db = tx ?? prisma;
    // Atomic increment — avoids read-modify-write race
    return db.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: { increment: delta } },
    });
  },

  async softDeleteItem(itemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.inventoryItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
  },

  // ─── Logs ────────────────────────────────────────────────────────────────
  async createLog(
    data: {
      itemId: number;
      changedBy: number;
      changeType: string;
      quantityDelta: number;
      note?: string | null;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.inventoryLog.create({ data: data as any });
  },

  async findLogs(
    itemId: number,
    pagination: { skip: number; take: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    const where = { itemId };
    const [rows, total] = await Promise.all([
      db.inventoryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.inventoryLog.count({ where }),
    ]);
    return { rows, total };
  },
};
