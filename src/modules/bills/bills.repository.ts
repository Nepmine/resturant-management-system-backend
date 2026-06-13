import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const billRepository = {
  async findAll(
    branchId: number,
    filters: { status?: string },
    pagination: { skip: number; take: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    const where: any = {
      branchId,
      deletedAt: null,
      ...(filters.status && { status: filters.status }),
    };
    const [rows, total] = await Promise.all([
      db.bill.findMany({ where, orderBy: { dueDate: 'asc' }, skip: pagination.skip, take: pagination.take }),
      db.bill.count({ where }),
    ]);
    return { rows, total };
  },

  async findById(billId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.bill.findFirst({ where: { id: billId, branchId, deletedAt: null } });
  },

  async create(
    data: { branchId: number; type: string; amount: number; dueDate: Date; note?: string | null },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.bill.create({ data: { status: 'unpaid', ...data } as any });
  },

  async update(
    billId: number,
    data: { amount?: number; dueDate?: Date; note?: string | null },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.bill.update({ where: { id: billId }, data: data as any });
  },

  async markPaid(billId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.bill.update({
      where: { id: billId },
      data: { status: 'paid', paidDate: new Date() } as any,
    });
  },

  async softDelete(billId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.bill.update({ where: { id: billId }, data: { deletedAt: new Date() } });
  },
};
