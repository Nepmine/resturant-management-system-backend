import { OrderStatus, OrderType, Prisma } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

const orderWithItems = {
  items: {
    where: { deletedAt: null },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.OrderInclude;

export const orderRepository = {
  async findAll(
    branchId: number,
    filters: {
      status?: OrderStatus;
      orderType?: OrderType;
      from?: Date;
      to?: Date;
      updatedAfter?: Date;
    },
    pagination: { skip: number; take: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    const where: Prisma.OrderWhereInput = {
      branchId,
      deletedAt: null,
      ...(filters.status     && { status: filters.status }),
      ...(filters.orderType  && { orderType: filters.orderType }),
      ...(filters.updatedAfter && { updatedAt: { gt: filters.updatedAfter } }),
      ...((filters.from || filters.to) && {
        createdAt: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to   && { lte: filters.to }),
        },
      }),
    };

    const [rows, total] = await Promise.all([
      db.order.findMany({
        where,
        include: orderWithItems,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.order.count({ where }),
    ]);

    return { rows, total };
  },

  async findById(orderId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: orderWithItems,
    });
  },

  async findByIdAndBranch(orderId: number, branchId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.order.findFirst({
      where: { id: orderId, branchId, deletedAt: null },
      include: orderWithItems,
    });
  },

  async findItemById(itemId: number, orderId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
    });
  },

  async create(
    data: Prisma.OrderCreateInput,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.order.create({ data, include: orderWithItems });
  },

  async createItems(
    items: Prisma.OrderItemCreateManyInput[],
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.orderItem.createMany({ data: items });
  },

  async updateStatus(
    orderId: number,
    status: OrderStatus,
    extra?: { acceptedByStaffId?: number },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.order.update({
      where: { id: orderId },
      data: { status, ...extra },
      include: orderWithItems,
    });
  },

  async cancelOrder(orderId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    // Cancel all non-terminal items too
    await db.orderItem.updateMany({
      where: {
        orderId,
        deletedAt: null,
        status: { notIn: ['delivered', 'cancelled'] },
      },
      data: { status: 'cancelled' },
    });
    return db.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
      include: orderWithItems,
    });
  },

  async cancelItem(itemId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.orderItem.update({
      where: { id: itemId },
      data: { status: 'cancelled' },
    });
  },

  async updateItemStatus(
    itemId: number,
    status: string,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.orderItem.update({
      where: { id: itemId },
      data: { status: status as any },
    });
  },
};
