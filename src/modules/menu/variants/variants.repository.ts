import { Prisma } from '@prisma/client';
import prisma from '../../../config/database';

type TxClient = Prisma.TransactionClient;

const groupWithOptions = {
  options: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.MenuItemOptionGroupInclude;

export const variantRepository = {
  // ─── Option Groups ──────────────────────────────────────────────────────

  async findAllGroups(menuItemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItemOptionGroup.findMany({
      where: { menuItemId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: groupWithOptions,
    });
  },

  async findGroupById(groupId: number, menuItemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItemOptionGroup.findFirst({
      where: { id: groupId, menuItemId, deletedAt: null },
      include: groupWithOptions,
    });
  },

  async createGroup(
    data: {
      menuItemId: number;
      name: string;
      isRequired?: boolean;
      sortOrder?: number;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItemOptionGroup.create({
      data: { isRequired: true, sortOrder: 0, ...data },
      include: groupWithOptions,
    });
  },

  async updateGroup(
    groupId: number,
    data: { name?: string; isRequired?: boolean; sortOrder?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItemOptionGroup.update({
      where: { id: groupId },
      data,
      include: groupWithOptions,
    });
  },

  async softDeleteGroup(groupId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    // Also soft-delete all child options atomically
    await db.menuItemOption.updateMany({
      where: { groupId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return db.menuItemOptionGroup.update({
      where: { id: groupId },
      data: { deletedAt: new Date() },
    });
  },

  // ─── Options (within a group) ───────────────────────────────────────────

  async findOptionById(optionId: number, groupId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItemOption.findFirst({
      where: { id: optionId, groupId, deletedAt: null },
    });
  },

  async createOption(
    data: {
      groupId: number;
      name: string;
      priceModifier?: number;
      sortOrder?: number;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItemOption.create({
      data: { priceModifier: 0, sortOrder: 0, ...data },
    });
  },

  async createManyOptions(
    options: Array<{
      groupId: number;
      name: string;
      priceModifier?: number;
      sortOrder?: number;
    }>,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItemOption.createMany({
      data: options.map((o) => ({
        priceModifier: 0,
        sortOrder: 0,
        ...o,
      })),
    });
  },

  async updateOption(
    optionId: number,
    data: { name?: string; priceModifier?: number; sortOrder?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.menuItemOption.update({ where: { id: optionId }, data });
  },

  async softDeleteOption(optionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItemOption.update({
      where: { id: optionId },
      data: { deletedAt: new Date() },
    });
  },

  /** Count non-deleted options in a group — prevents deleting the last one. */
  async countActiveOptions(groupId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.menuItemOption.count({ where: { groupId, deletedAt: null } });
  },
};
