import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { auditLog } from '../../utils/auditLog';
import { buildMeta, parsePagination } from '../../utils/pagination';
import { branchRepository } from '../branches/branches.repository';
import { orderRepository } from './orders.repository';
import { syncOrderStatus } from './orders.aggregation';
import type {
  UpdateOrderStatusDto,
  CancelOrderDto,
  CancelOrderItemDto,
  CreateParcelOrderDto,
  OrderDto,
  OrderItemDto,
} from './orders.dto';
import type { Prisma } from '@prisma/client';

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
}): OrderItemDto {
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
  branchId: number;
  memberId: number | null;
  orderType: string;
  isParcel: boolean;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  note: string | null;
  acceptedByStaffId: number | null;
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
}): OrderDto {
  return {
    id: o.id,
    sessionId: o.sessionId,
    branchId: o.branchId,
    memberId: o.memberId,
    orderType: o.orderType,
    isParcel: o.isParcel,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    status: o.status,
    note: o.note,
    acceptedByStaffId: o.acceptedByStaffId,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items.map(formatItem),
  };
}

// ─── snapshot helper ───────────────────────────────────────────────────────

/**
 * Validates requested menu items exist, are available and belong to the branch.
 * Returns a map of id → { item, variant } with prices for snapshotting.
 */
async function snapshotItems(
  branchId: number,
  requestedItems: Array<{
    menuItemId: number;
    variantId?: number;
    quantity: number;
    note?: string;
  }>,
  tx: Prisma.TransactionClient,
) {
  const itemIds = [...new Set(requestedItems.map((i) => i.menuItemId))];

  const menuItems = await tx.menuItem.findMany({
    where: {
      id: { in: itemIds },
      deletedAt: null,
      category: { branchId, deletedAt: null },
    },
    include: {
      optionGroups: {
        where: { deletedAt: null },
        include: { options: { where: { deletedAt: null } } },
      },
    },
  });

  if (menuItems.length !== itemIds.length) {
    const found = new Set(menuItems.map((m) => m.id));
    const missing = itemIds.filter((id) => !found.has(id));
    throw new AppError(
      `Menu item(s) not found or not available in this branch: ${missing.join(', ')}`,
      400,
      'ITEM_NOT_FOUND',
    );
  }

  const unavailable = menuItems.filter((m) => !m.isAvailable);
  if (unavailable.length > 0) {
    throw new AppError(
      `Item(s) currently unavailable: ${unavailable.map((m) => m.name).join(', ')}`,
      400,
      'ITEM_UNAVAILABLE',
    );
  }

  return requestedItems.map((req) => {
    const menuItem = menuItems.find((m) => m.id === req.menuItemId)!;
    let variantName: string | null = null;
    let priceModifier = 0;

    if (req.variantId) {
      const option = menuItem.optionGroups
        .flatMap((g) => g.options)
        .find((o) => o.id === req.variantId);
      if (!option) {
        throw new AppError(
          `Variant ${req.variantId} not found for item "${menuItem.name}"`,
          400,
          'VARIANT_NOT_FOUND',
        );
      }
      variantName = option.name;
      priceModifier = Number(option.priceModifier);
    }

    return {
      menuItemId: req.menuItemId,
      variantId: req.variantId ?? null,
      quantity: req.quantity,
      unitPrice: Number(menuItem.basePrice) + priceModifier,
      itemNameSnapshot: menuItem.name,
      variantNameSnapshot: variantName,
      note: req.note ?? null,
      status: 'pending' as const,
    };
  });
}

// ─── service ───────────────────────────────────────────────────────────────

export const orderService = {
  async list(
    branchId: number,
    restaurantId: number,
    query: Record<string, string | undefined>,
  ) {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const { skip, take } = parsePagination(query);
    const { rows, total } = await orderRepository.findAll(
      branchId,
      {
        status: query.status as any,
        orderType: query.orderType as any,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to + 'T23:59:59Z') : undefined,
        updatedAfter: query.updatedAfter ? new Date(query.updatedAfter) : undefined,
      },
      { skip, take },
    );

    return {
      data: rows.map(formatOrder),
      meta: buildMeta(total, skip, take),
    };
  },

  async getById(orderId: number, branchId: number, restaurantId: number): Promise<OrderDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const order = await orderRepository.findByIdAndBranch(orderId, branchId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    return formatOrder(order);
  },

  /**
   * PATCH /orders/:orderId/status — Staff+
   * §F4: Only pending → confirmed is a manual transition.
   * Sets accepted_by_staff_id on confirmation.
   */
  async updateStatus(
    orderId: number,
    branchId: number,
    restaurantId: number,
    staffId: number,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

      if (order.status !== 'pending') {
        throw new AppError(
          `Only pending orders can be confirmed (current status: ${order.status})`,
          409,
          'INVALID_STATUS_TRANSITION',
        );
      }

      const updated = await orderRepository.updateStatus(
        orderId,
        'confirmed',
        { acceptedByStaffId: staffId },
        tx,
      );

      await auditLog(tx, {
        staffId,
        branchId,
        action: 'order.confirmed',
        actionType: 'order.confirmed',
        targetType: 'order',
        targetId: orderId,
        meta: { previousStatus: 'pending' },
      });

      return formatOrder(updated);
    });
  },

  /**
   * PATCH /orders/:orderId/cancel — Staff+
   * Cancels the order and all non-terminal items.
   * Logs reason to activity_logs.
   */
  async cancelOrder(
    orderId: number,
    branchId: number,
    restaurantId: number,
    staffId: number,
    dto: CancelOrderDto,
  ): Promise<OrderDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
      if (order.status === 'cancelled') {
        throw new AppError('Order is already cancelled', 409, 'ALREADY_CANCELLED');
      }
      if (order.status === 'delivered') {
        throw new AppError('Delivered orders cannot be cancelled', 409, 'ORDER_DELIVERED');
      }

      const updated = await orderRepository.cancelOrder(orderId, tx);

      await auditLog(tx, {
        staffId,
        branchId,
        action: 'order.cancelled',
        actionType: 'order.cancelled',
        targetType: 'order',
        targetId: orderId,
        meta: { reason: dto.reason, previousStatus: order.status },
      });

      return formatOrder(updated);
    });
  },

  /**
   * PATCH /orders/:orderId/items/:itemId/cancel — Staff+
   * Cancel a single item; re-derives order status.
   */
  async cancelItem(
    orderId: number,
    itemId: number,
    branchId: number,
    restaurantId: number,
    staffId: number,
    dto: CancelOrderItemDto,
  ): Promise<OrderDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, branchId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

      const item = await orderRepository.findItemById(itemId, orderId, tx);
      if (!item) throw new AppError('Order item not found', 404, 'NOT_FOUND');
      if (item.status === 'cancelled') {
        throw new AppError('Item is already cancelled', 409, 'ALREADY_CANCELLED');
      }
      if (item.status === 'delivered') {
        throw new AppError('Delivered items cannot be cancelled', 409, 'ITEM_DELIVERED');
      }

      await orderRepository.cancelItem(itemId, tx);
      await syncOrderStatus(orderId, tx);

      await auditLog(tx, {
        staffId,
        branchId,
        action: 'order_item.cancelled',
        actionType: 'order_item.cancelled',
        targetType: 'order_item',
        targetId: itemId,
        meta: { orderId, reason: dto.reason },
      });

      const updated = await orderRepository.findByIdAndBranch(orderId, branchId, tx);
      return formatOrder(updated!);
    });
  },

  /**
   * POST /orders/parcel — Staff+
   * §F3: Parcel orders have no sessionId, no memberId.
   * §B2.13: customerName + customerPhone required.
   */
  async createParcel(
    branchId: number,
    restaurantId: number,
    staffId: number,
    dto: CreateParcelOrderDto,
  ): Promise<OrderDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const snapshots = await snapshotItems(branchId, dto.items, tx);

      const order = await orderRepository.create(
        {
          session: undefined,
          branch: { connect: { id: branchId } },
          orderType: 'parcel',
          isParcel: true,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
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
        staffId,
        branchId,
        action: 'order.parcel_created',
        actionType: 'order.parcel_created',
        targetType: 'order',
        targetId: order.id,
        meta: { customerName: dto.customerName, itemCount: dto.items.length },
      });

      const full = await orderRepository.findByIdAndBranch(order.id, branchId, tx);
      return formatOrder(full!);
    });
  },

  // Exposed for use by kitchen and customer modules
  snapshotItems,
  formatOrder,
  formatItem,
};
