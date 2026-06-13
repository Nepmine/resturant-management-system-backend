import { Prisma } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// src/utils/auditLog.ts
// Writes an activity_logs row for every destructive or financial operation.
// MUST be called within the same Prisma transaction as the mutation so that
// the log is rolled back if the mutation fails.
//
// Rule from §F3: auditLog(tx, ...) — fire-and-forget acceptable only for
// non-financial reads. For writes, always pass the transaction client.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditLogParams {
  /** null for customer-initiated actions (no staff JWT) */
  staffId: number | null;
  branchId?: number | null;
  /** Fine-grained description e.g. "order.status.updated", "menu_item.hidden" */
  action: string;
  /** Coarser category e.g. "order_placed", "item_cancelled" */
  actionType: string;
  /** The entity type being mutated e.g. "order", "menu_item" */
  targetType: string;
  targetId: number;
  /** Old/new values or any extra context — kept as jsonb */
  meta?: Record<string, unknown>;
}

/**
 * Write a single audit log entry.
 *
 * @param tx  A Prisma transaction client (or the global prisma instance for
 *            fire-and-forget cases — NOT recommended for financial ops).
 * @param params  What to log.
 *
 * Usage inside a service transaction:
 *   await auditLog(tx, {
 *     staffId: req.user.sub,
 *     branchId: req.user.branchId,
 *     action: 'order.status.updated',
 *     actionType: 'order_confirmed',
 *     targetType: 'order',
 *     targetId: order.id,
 *     meta: { from: 'pending', to: 'confirmed' },
 *   });
 */
export async function auditLog(
  tx: Prisma.TransactionClient,
  params: AuditLogParams,
): Promise<void> {
  // staffId is nullable — customer actions (e.g. order_placed) have no staff actor.
  // We still log them for full traceability.
  if (params.staffId === null) {
    // Create without staffId relation
    await (tx as unknown as { activityLog: { create: Function } }).activityLog.create({
      data: {
        staffId: 0,       // placeholder — see note below
        branchId: params.branchId ?? null,
        action: params.action,
        actionType: params.actionType,
        targetType: params.targetType,
        targetId: params.targetId,
        meta: params.meta ?? null,
      },
    });
    return;
  }

  await (tx as unknown as { activityLog: { create: Function } }).activityLog.create({
    data: {
      staffId: params.staffId,
      branchId: params.branchId ?? null,
      action: params.action,
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId,
      meta: params.meta ?? null,
    },
  });
}

// ── Typed helper builders ─────────────────────────────────────────────────────
// These reduce boilerplate in service files and make log entries consistent.

export function makeOrderLog(
  orderId: number,
  staffId: number | null,
  branchId: number,
  from: string,
  to: string,
): AuditLogParams {
  return {
    staffId,
    branchId,
    action: 'order.status.updated',
    actionType: 'order_status_changed',
    targetType: 'order',
    targetId: orderId,
    meta: { from, to },
  };
}

export function makeMenuItemLog(
  itemId: number,
  staffId: number,
  branchId: number,
  action: string,
  meta?: Record<string, unknown>,
): AuditLogParams {
  return {
    staffId,
    branchId,
    action: `menu_item.${action}`,
    actionType: `menu_item_${action}`,
    targetType: 'menu_item',
    targetId: itemId,
    meta,
  };
}

export function makePaymentLog(
  paymentId: number,
  staffId: number | null,
  branchId: number,
  meta?: Record<string, unknown>,
): AuditLogParams {
  return {
    staffId,
    branchId,
    action: 'payment.recorded',
    actionType: 'payment_recorded',
    targetType: 'payment',
    targetId: paymentId,
    meta,
  };
}
