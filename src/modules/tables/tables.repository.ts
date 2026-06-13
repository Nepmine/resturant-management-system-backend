import { Prisma, TableStatus } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const tableRepository = {
  async findAll(
    branchId: number,
    filters: { sectionId?: number; status?: TableStatus },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.table.findMany({
      where: {
        branchId,
        deletedAt: null,
        ...(filters.sectionId !== undefined && { sectionId: filters.sectionId }),
        ...(filters.status !== undefined && { status: filters.status }),
      },
      orderBy: [{ sectionId: 'asc' }, { tableNumber: 'asc' }],
      include: { section: { select: { id: true, name: true } } },
    });
  },

  async findById(tableId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.table.findFirst({
      where: { id: tableId, deletedAt: null },
      include: { section: { select: { id: true, name: true } } },
    });
  },

  async findByBranchAndId(tableId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.table.findFirst({
      where: { id: tableId, branchId, deletedAt: null },
    });
  },

  async findByQrToken(qrToken: string, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.table.findFirst({
      where: { qrToken, deletedAt: null },
    });
  },

  /** Check uniqueness of tableNumber within a section, excluding a specific id. */
  async existsWithTableNumber(
    sectionId: number,
    tableNumber: number,
    excludeId?: number,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    const row = await db.table.findFirst({
      where: {
        sectionId,
        tableNumber,
        deletedAt: null,
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return row !== null;
  },

  async create(
    data: {
      branchId: number;
      sectionId: number;
      tableNumber: number;
      label?: string;
      qrToken: string;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.table.create({ data });
  },

  async update(
    tableId: number,
    data: { tableNumber?: number; label?: string },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.table.update({ where: { id: tableId }, data });
  },

  async updateStatus(tableId: number, status: TableStatus, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.table.update({ where: { id: tableId }, data: { status } });
  },

  async updateQrToken(tableId: number, qrToken: string, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.table.update({ where: { id: tableId }, data: { qrToken } });
  },

  async softDelete(tableId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.table.update({
      where: { id: tableId },
      data: { deletedAt: new Date() },
    });
  },
};
