import { ItemStatus, OrderStatus, Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

/**
 * §F4: Order status is DERIVED from item statuses — never set independently
 * (except the single manual transition: pending → confirmed).
 *
 * Rules applied in priority order:
 *   1. Any item 'preparing'                          → order = 'preparing'
 *   2. All items in {'ready','delivered','cancelled'}
 *      AND at least one 'ready'                      → order = 'ready'
 *   3. All items in {'delivered','cancelled'}
 *      AND at least one 'delivered'                  → order = 'delivered'
 *   4. All items 'cancelled'                         → order = 'cancelled'
 *   5. Otherwise (mixed in-progress)                 → order = 'preparing'
 *
 * Called inside the same transaction as the item-status update so the
 * parent order is always consistent with its items.
 */
export async function deriveOrderStatus(
  orderId: number,
  tx: TxClient,
): Promise<OrderStatus> {
  const items = await tx.orderItem.findMany({
    where: { orderId, deletedAt: null },
    select: { status: true },
  });

  if (items.length === 0) return 'pending';

  const statuses = items.map((i) => i.status as ItemStatus);

  const allCancelled  = statuses.every((s) => s === 'cancelled');
  const anyPreparing  = statuses.some((s)  => s === 'preparing');
  const allTerminal   = statuses.every((s) => s === 'delivered' || s === 'cancelled');
  const anyDelivered  = statuses.some((s)  => s === 'delivered');
  const allReadyOrBeyond = statuses.every(
    (s) => s === 'ready' || s === 'delivered' || s === 'cancelled',
  );
  const anyReady      = statuses.some((s) => s === 'ready');

  if (allCancelled)                  return 'cancelled';
  if (allTerminal && anyDelivered)   return 'delivered';
  if (anyPreparing)                  return 'preparing';
  if (allReadyOrBeyond && anyReady)  return 'ready';
  return 'preparing';
}

/**
 * Apply the derived status to the order row inside the same transaction.
 * Only updates when the status actually changes.
 */
export async function syncOrderStatus(
  orderId: number,
  tx: TxClient,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) return;

  const derived = await deriveOrderStatus(orderId, tx);

  // Never downgrade a confirmed order back to pending via item-status sync
  if (order.status === 'confirmed' && derived === 'pending') return;
  // Never overwrite cancelled with a derived non-cancelled (edge case)
  if (order.status === 'cancelled') return;
  // No-op if already correct
  if (order.status === derived) return;

  await tx.order.update({ where: { id: orderId }, data: { status: derived } });
}
