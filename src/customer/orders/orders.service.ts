import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { auditLog } from '../../utils/auditLog';
import { orderRepository } from '../../modules/orders/orders.repository';
import { orderService } from '../../modules/orders/orders.service';
import type { MemberTokenPayload } from '../../types/express';
import type {
  PlaceOrderDto,
  AddItemsDto,
  CustomerOrderDto,
  CustomerOrderItemDto,
} from './orders.dto';

// ─── formatters ────────────────────────────────────────────────────────────

function formatItem(i: {
  id: number;
  menuItemId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number | { toNumber(): number };
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  status: string;
  note: string | null;
}): CustomerOrderItemDto {
  return {
    id: i.id,
    menuItemId: i.menuItemId,
    variantId: i.variantId,
    quantity: i.quantity,
    unitPrice: typeof i.unitPrice === 'object' ? i.unitPrice.toNumber() : Number(i.unitPrice),
    itemNameSnapshot: i.itemNameSnapshot,
    variantNameSnapshot: i.variantNameSnapshot,
    status: i.status,
    note: i.note,
  };
}

function formatOrder(o: {
  id: number;
  sessionId: number | null;
  orderType: string;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    menuItemId: number;
    variantId: number | null;
    quantity: number;
    unitPrice: number | { toNumber(): number };
    itemNameSnapshot: string;
    variantNameSnapshot: string | null;
    status: string;
    note: string | null;
  }>;
}): CustomerOrderDto {
  const items = o.items.map(formatItem);
  const subtotal = items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  return {
    id: o.id,
    sessionId: o.sessionId!,
    orderType: o.orderType,
    status: o.status,
    note: o.note,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items,
    subtotal,
  };
}

// ─── service ───────────────────────────────────────────────────────────────

export const customerOrderService = {
  /**
   * POST /customer/orders — Member JWT
   * §F3 / §E4: Places a dine-in order for the current session.
   * Prices are snapshotted atomically — menu changes do not affect placed orders.
   */
  async placeOrder(
    member: MemberTokenPayload,
    dto: PlaceOrderDto,
  ): Promise<CustomerOrderDto> {
    return prisma.$transaction(async (tx) => {
      // Verify session is still active and belongs to this member
      const session = await tx.diningSession.findFirst({
        where: { id: member.sessionId, status: 'active' },
        select: { id: true },
      });
      if (!session) {
        throw new AppError('Session is not active', 400, 'SESSION_NOT_ACTIVE');
      }

      // Snapshot and validate items (reuses staff-side utility)
      const snapshots = await orderService.snapshotItems(
        member.branchId,
        dto.items,
        tx,
      );

      const order = await orderRepository.create(
        {
          session: { connect: { id: member.sessionId } },
          branch: { connect: { id: member.branchId } },
          member: { connect: { id: member.sub } },
          orderType: 'dine_in',
          isParcel: false,
          status: 'pending',
          note: dto.note ?? null,
        },
        tx,
      );

      await orderRepository.createItems(
        snapshots.map((s) => ({ orderId: order.id, ...s })),
        tx,
      );

      await auditLog(tx, {
        staffId: null,
        branchId: member.branchId,
        action: 'order.placed',
        actionType: 'order.placed',
        targetType: 'order',
        targetId: order.id,
        meta: { sessionId: member.sessionId, memberId: member.sub, itemCount: dto.items.length },
      });

      const full = await orderRepository.findByIdAndBranch(order.id, member.branchId, tx);
      return formatOrder(full!);
    });
  },

  /**
   * GET /customer/orders — Member JWT
   * All orders placed within the current session.
   */
  async listSessionOrders(
    member: MemberTokenPayload,
    updatedAfter?: Date,
  ): Promise<CustomerOrderDto[]> {
    const where = {
      sessionId: member.sessionId,
      deletedAt: null as null,
      ...(updatedAfter && { updatedAt: { gt: updatedAfter } }),
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { where: { deletedAt: null }, orderBy: { id: 'asc' as const } },
      },
      orderBy: { createdAt: 'asc' as const },
    });

    return orders.map(formatOrder);
  },

  /**
   * GET /customer/orders/:orderId — Member JWT
   * Single order; verifies it belongs to this member's session.
   */
  async getById(
    orderId: number,
    member: MemberTokenPayload,
  ): Promise<CustomerOrderDto> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, sessionId: member.sessionId, deletedAt: null },
      include: {
        items: { where: { deletedAt: null }, orderBy: { id: 'asc' as const } },
      },
    });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    return formatOrder(order);
  },

  /**
   * POST /customer/orders/:orderId/items — Member JWT
   * Add items to an existing PENDING order.
   * §E4: Items are price-snapshotted atomically.
   */
  async addItems(
    orderId: number,
    member: MemberTokenPayload,
    dto: AddItemsDto,
  ): Promise<CustomerOrderDto> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, sessionId: member.sessionId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

      if (order.status !== 'pending') {
        throw new AppError(
          `Items can only be added to pending orders (current: ${order.status})`,
          409,
          'ORDER_NOT_PENDING',
        );
      }

      const snapshots = await orderService.snapshotItems(
        member.branchId,
        dto.items,
        tx,
      );

      await orderRepository.createItems(
        snapshots.map((s) => ({ orderId, ...s })),
        tx,
      );

      const full = await orderRepository.findByIdAndBranch(orderId, member.branchId, tx);
      return formatOrder(full!);
    });
  },

  /**
   * POST /customer/orders/:orderId/cancel — Member JWT
   * §E4: Cancel only if still pending.
   */
  async cancelOrder(
    orderId: number,
    member: MemberTokenPayload,
  ): Promise<CustomerOrderDto> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, sessionId: member.sessionId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

      if (order.status !== 'pending') {
        throw new AppError(
          `Only pending orders can be cancelled by customers (current: ${order.status})`,
          409,
          'CANNOT_CANCEL',
        );
      }

      // Cancel order and all items
      await tx.orderItem.updateMany({
        where: { orderId, deletedAt: null },
        data: { status: 'cancelled' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      const full = await orderRepository.findByIdAndBranch(orderId, member.branchId, tx);
      return formatOrder(full!);
    });
  },
};
