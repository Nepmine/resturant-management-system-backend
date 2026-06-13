import prisma from '../config/database';

/**
 * §G: snapshotDailyMetrics
 * Runs at 00:05 daily (yesterday's date).
 * Atomically populates daily_branch_metrics, daily_item_metrics, and
 * staff_daily_metrics for each active branch.
 *
 * Uses UPSERT so reruns are safe (idempotent).
 * Reads: orders, order_items, payments, dining_sessions, session_members, staff_users.
 * Writes: daily_branch_metrics, daily_item_metrics, staff_daily_metrics.
 */
export async function snapshotDailyMetrics(targetDate?: Date): Promise<void> {
  // Default: yesterday (job runs at 00:05, snapshots the completed day)
  const date = targetDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  })();

  const dateStr  = date.toISOString().slice(0, 10);        // YYYY-MM-DD
  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd   = new Date(dateStr + 'T23:59:59.999Z');

  console.log(`[snapshotMetrics] Snapshotting metrics for ${dateStr}`);

  const branches = await prisma.branch.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, restaurantId: true },
  });

  for (const branch of branches) {
    try {
      await prisma.$transaction(async (tx) => {
        // ── 1. Branch-level metrics ──────────────────────────────────────

        // All completed orders for the day
        const orders = await tx.order.findMany({
          where: {
            branchId: branch.id,
            deletedAt: null,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          include: {
            items: { where: { deletedAt: null } },
          },
        });

        // Revenue from completed payments for orders in this day-window
        const payments = await tx.payment.findMany({
          where: {
            session: { branchId: branch.id },
            status: 'completed',
            amount: { gt: 0 },
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          select: { amount: true, method: true },
        });

        const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
        const cashRevenue  = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + Number(p.amount), 0);
        const onlineRevenue = payments.filter((p) => p.method === 'esewa').reduce((s, p) => s + Number(p.amount), 0);

        const totalOrders     = orders.length;
        const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
        const dineinOrders    = orders.filter((o) => o.orderType === 'dine_in').length;
        const parcelOrders    = orders.filter((o) => o.orderType === 'parcel').length;

        // Sessions that started this day
        const sessions = await tx.diningSession.findMany({
          where: {
            branchId: branch.id,
            startedAt: { gte: dayStart, lte: dayEnd },
          },
          include: { members: { select: { id: true } } },
        });

        const totalSessions  = sessions.length;
        const totalCustomers = sessions.reduce((s, sess) => s + sess.members.length, 0);
        const completedPayments = payments.length;

        const nonCancelledOrders = orders.filter((o) => o.status !== 'cancelled');
        const avgOrderValue = nonCancelledOrders.length > 0
          ? totalRevenue / nonCancelledOrders.length
          : null;

        await tx.dailyBranchMetrics.upsert({
          where: { branchId_snapshotDate: { branchId: branch.id, snapshotDate: new Date(dateStr) } },
          create: {
            branchId: branch.id,
            snapshotDate: new Date(dateStr),
            totalRevenue,
            cashRevenue,
            onlineRevenue,
            totalOrders,
            cancelledOrders,
            dineinOrders,
            parcelOrders,
            totalSessions,
            totalCustomers,
            avgOrderValue,
            completedPayments,
          },
          update: {
            totalRevenue,
            cashRevenue,
            onlineRevenue,
            totalOrders,
            cancelledOrders,
            dineinOrders,
            parcelOrders,
            totalSessions,
            totalCustomers,
            avgOrderValue,
            completedPayments,
          },
        });

        // ── 2. Item-level metrics ────────────────────────────────────────

        // Aggregate sold quantities and revenue per menu item for the day
        const itemAgg: Record<number, { quantitySold: number; revenueGenerated: number }> = {};

        for (const order of nonCancelledOrders) {
          for (const item of order.items) {
            if (item.status === 'cancelled') continue;
            if (!itemAgg[item.menuItemId]) {
              itemAgg[item.menuItemId] = { quantitySold: 0, revenueGenerated: 0 };
            }
            itemAgg[item.menuItemId].quantitySold    += item.quantity;
            itemAgg[item.menuItemId].revenueGenerated += Number(item.unitPrice) * item.quantity;
          }
        }

        for (const [menuItemIdStr, stats] of Object.entries(itemAgg)) {
          const menuItemId = Number(menuItemIdStr);
          await tx.dailyItemMetrics.upsert({
            where: {
              branchId_menuItemId_snapshotDate: {
                branchId: branch.id,
                menuItemId,
                snapshotDate: new Date(dateStr),
              },
            },
            create: {
              branchId: branch.id,
              menuItemId,
              snapshotDate: new Date(dateStr),
              quantitySold: stats.quantitySold,
              revenueGenerated: stats.revenueGenerated,
            },
            update: {
              quantitySold: stats.quantitySold,
              revenueGenerated: stats.revenueGenerated,
            },
          });
        }

        // ── 3. Staff-level metrics ───────────────────────────────────────

        // Orders confirmed (accepted) by staff today
        const acceptedOrders = orders.filter((o) => o.acceptedByStaffId !== null);

        const staffAgg: Record<number, {
          ordersHandled: number;
          salesAmount: number;
          cancelledOrders: number;
          completionTimes: number[];
        }> = {};

        for (const order of acceptedOrders) {
          const sid = order.acceptedByStaffId!;
          if (!staffAgg[sid]) {
            staffAgg[sid] = { ordersHandled: 0, salesAmount: 0, cancelledOrders: 0, completionTimes: [] };
          }
          staffAgg[sid].ordersHandled += 1;
          if (order.status === 'cancelled') {
            staffAgg[sid].cancelledOrders += 1;
          } else {
            const orderRevenue = order.items
              .filter((i) => i.status !== 'cancelled')
              .reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
            staffAgg[sid].salesAmount += orderRevenue;

            // Approximate completion time: updatedAt - createdAt for delivered orders
            if (order.status === 'delivered') {
              const seconds = (order.updatedAt.getTime() - order.createdAt.getTime()) / 1000;
              if (seconds > 0) staffAgg[sid].completionTimes.push(seconds);
            }
          }
        }

        for (const [staffIdStr, stats] of Object.entries(staffAgg)) {
          const staffUserId = Number(staffIdStr);
          const avgSeconds  = stats.completionTimes.length > 0
            ? Math.round(stats.completionTimes.reduce((s, t) => s + t, 0) / stats.completionTimes.length)
            : null;

          await tx.staffDailyMetrics.upsert({
            where: { staffId_snapshotDate: { staffId: staffUserId, snapshotDate: new Date(dateStr) } },
            create: {
              staffId: staffUserId,
              branchId: branch.id,
              snapshotDate: new Date(dateStr),
              ordersHandled: stats.ordersHandled,
              sessionsHandled: sessions.filter((s) => s.members.some(() => true)).length,
              salesAmount: stats.salesAmount,
              cancelledOrders: stats.cancelledOrders,
              avgOrderCompletionSeconds: avgSeconds,
            },
            update: {
              ordersHandled: stats.ordersHandled,
              salesAmount: stats.salesAmount,
              cancelledOrders: stats.cancelledOrders,
              avgOrderCompletionSeconds: avgSeconds,
            },
          });
        }
      });

      console.log(`[snapshotMetrics] Branch ${branch.id} done for ${dateStr}`);
    } catch (err) {
      // Per-branch failure — log but continue other branches
      console.error(`[snapshotMetrics] Branch ${branch.id} FAILED for ${dateStr}:`, err);
    }
  }

  console.log(`[snapshotMetrics] Complete for ${dateStr}`);
}
