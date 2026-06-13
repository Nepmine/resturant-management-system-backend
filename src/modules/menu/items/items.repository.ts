import { Prisma } from '@prisma/client';
import prisma from '../../../config/database';

type TxClient = Prisma.TransactionClient;

const itemWithVariants = {
  optionGroups: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      options: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
} satisfies Prisma.MenuItemInclude;

export const itemRepository = {
  async findAllByCategory(categoryId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItem.findMany({
      where: { categoryId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async findById(itemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItem.findFirst({
      where: { id: itemId, deletedAt: null },
      include: itemWithVariants,
    });
  },

  /** Verify item belongs to a specific branch (via category). */
  async findByIdAndBranch(itemId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItem.findFirst({
      where: {
        id: itemId,
        deletedAt: null,
        category: { branchId, deletedAt: null },
      },
      include: itemWithVariants,
    });
  },

  async create(
    data: {
      categoryId: number;
      name: string;
      description?: string;
      basePrice: number;
      imageUrl?: string;
      isAvailable?: boolean;
      sortOrder?: number;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItem.create({
      data: { isAvailable: true, sortOrder: 0, ...data },
      include: itemWithVariants,
    });
  },

  async update(
    itemId: number,
    data: {
      name?: string;
      description?: string;
      basePrice?: number;
      imageUrl?: string | null;
      sortOrder?: number;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItem.update({
      where: { id: itemId },
      data,
      include: itemWithVariants,
    });
  },

  async updateAvailability(
    itemId: number,
    data: { isAvailable: boolean; disableNote?: string | null },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItem.update({
      where: { id: itemId },
      data,
    });
  },

  async softDelete(itemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });
  },
};
