import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { orderRepository } from '../orders/orders.repository';
import { syncOrderStatus } from '../orders/orders.aggregation';
import { kitchenRepository } from './kitchen.repository';
import type { KdsOrderDto, KdsItemDto, KdsQueueDto } from './kitchen.dto';

// ─── formatters ────────────────────────────────────────────────────────────

function formatKdsItem(i: {
  id: number;
  orderId: number;
  menuItemId: number;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  note: string | null;
  status: string;
}): KdsItemDto {
  return {
    id: i.id,
    orderId: i.orderId,
    menuItemId: i.menuItemId,
    itemNameSnapshot: i.itemNameSnapshot,
    variantNameSnapshot: i.variantNameSnapshot,
    quantity: i.quantity,
    note: i.note,
    status: i.status,
  };
}

type RawKdsOrder = {
  id: number;
  sessionId: number | null;
  orderType: string;
  isParcel: boolean;
  customerName: string | null;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    orderId: number;
    menuItemId: number;
    itemNameSnapshot: string;
    variantNameSnapshot: string | null;
    quantity: number;
    note: string | null;
    status: string;
  }>;
  session: {
    table: {
      tableNumber: number;
      section: { name: string };
    };
  } | null;
};

function formatKdsOrder(o: RawKdsOrder): KdsOrderDto {
  return {
    id: o.id,
    sessionId: o.sessionId,
    orderType: o.orderType,
    isParcel: o.isParcel,
    customerName: o.customerName,
    tableNumber: o.session?.table?.tableNumber ?? null,
    sectionName: o.session?.table?.section?.name ?? null,
    status: o.status,
    note: o.note,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items.map(formatKdsItem),
  };
}

// ─── valid KDS transitions ──────────────────────────────────────────────────
// pending → preparing → ready → delivered
// (cancelled is handled by the orders module, not KDS)
const KDS_TRANSITIONS: Record<string, string> = {
  preparing: 'pending',   // item must be pending to mark preparing
  ready: 'preparing',     // item must be preparing to mark ready
  delivered: 'ready',     // item must be ready to mark delivered
};

// ─── service ───────────────────────────────────────────────────────────────

export const kitchenService = {
  /**
   * GET /branches/:branchId/kitchen/orders — Staff+
   * Active orders grouped by status for the full KDS board.
   */
  async getOrders(
    branchId: number,
    restaurantId: number,
    updatedAfter?: Date,
  ): Promise<KdsOrderDto[]> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const orders = await kitchenRepository.findActiveOrders(branchId, updatedAfter);
    return orders.map(formatKdsOrder);
  },

  /**
   * GET /branches/:branchId/kitchen/queue — Staff+
   * Pending + preparing items only — what the kitchen needs to action now.
   */
  async getQueue(
    branchId: number,
    restaurantId: number,
    updatedAfter?: Date,
  ): Promise<KdsQueueDto[]> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const orders = await kitchenRepository.findQueueOrders(branchId, updatedAfter);
    return orders.map((o: any): KdsQueueDto => ({
      orderId: o.id,
      tableNumber: o.session?.table?.tableNumber ?? null,
      orderType: o.orderType,
      isParcel: o.isParcel,
      customerName: o.customerName,
      createdAt: o.createdAt,
      pendingItems: o.items
        .filter((i: any) => i.status === 'pending')
        .map(formatKdsItem),
      preparingItems: o.items
        .filter((i: any) => i.status === 'preparing')
        .map(formatKdsItem),
    }));
  },

  /**
   * Generic item status transition — used by all three KDS endpoints.
   * Validates the from-state, updates the item, then re-derives the order status (§F4).
   */
  async transitionItem(
    itemId: number,
    branchId: number,
    restaurantId: number,
    targetStatus: 'preparing' | 'ready' | 'delivered',
  ): Promise<KdsItemDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      const item = await kitchenRepository.findItemById(itemId, tx);
      if (!item) throw new AppError('Order item not found', 404, 'NOT_FOUND');

      // Verify item belongs to this branch
      if (item.order.branchId !== branchId) {
        throw new AppError('Order item not found', 404, 'NOT_FOUND');
      }

      const requiredFrom = KDS_TRANSITIONS[targetStatus];
      if (item.status !== requiredFrom) {
        throw new AppError(
          `Item must be '${requiredFrom}' to mark as '${targetStatus}' (current: '${item.status}')`,
          409,
          'INVALID_STATUS_TRANSITION',
        );
      }

      await orderRepository.updateItemStatus(itemId, targetStatus, tx);

      // §F4: Re-derive order status from all items in the same transaction
      await syncOrderStatus(item.order.id, tx);

      return { ...formatKdsItem(item), status: targetStatus };
    });
  },

  async markPreparing(itemId: number, branchId: number, restaurantId: number) {
    return kitchenService.transitionItem(itemId, branchId, restaurantId, 'preparing');
  },

  async markReady(itemId: number, branchId: number, restaurantId: number) {
    return kitchenService.transitionItem(itemId, branchId, restaurantId, 'ready');
  },

  async markDelivered(itemId: number, branchId: number, restaurantId: number) {
    return kitchenService.transitionItem(itemId, branchId, restaurantId, 'delivered');
  },
};
