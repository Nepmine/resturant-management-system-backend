import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import type { StaffDashboardDto, BranchDashboardDto, AdminDashboardDto } from './dashboard.dto';

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object' && 'toNumber' in (v as any)) return (v as any).toNumber();
  return Number(v);
}

export const dashboardService = {
  /**
   * GET /dashboard — Staff+
   * §D17: live operational state — active orders, sessions, table counts,
   * pending waiter calls; revenue/order count from daily_branch_metrics snapshot.
   */
  async getStaffDashboard(
    branchId: number,
    restaurantId: number,
  ): Promise<StaffDashboardDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const today = new Date().toISOString().slice(0, 10);

    const [
      activeOrders,
      activeSessions,
      tableStatuses,
      pendingWaiterCalls,
      todaySnapshot,
      lowStockItems,
    ] = await Promise.all([
      // Active orders count (live)
      prisma.order.count({
        where: {
          branchId,
          deletedAt: null,
          status: { in: ['pending', 'confirmed', 'preparing', 'ready'] },
        },
      }),
      // Active sessions (live)
      prisma.diningSession.count({ where: { branchId, status: 'active' } }),
      // Table status breakdown (live)
      prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
        SELECT status, COUNT(*)::INT as count
        FROM tables
        WHERE branch_id = ${branchId} AND deleted_at IS NULL
        GROUP BY status
      `,
      // Pending waiter calls (live)
      prisma.waiterRequest.count({
        where: {
          branchId,
          status: { in: ['pending', 'acknowledged'] },
        },
      }),
      // Revenue + orders today from snapshot table (§D17: reads snapshot, never raw orders)
      prisma.dailyBranchMetric.findFirst({
        where: { branchId, snapshotDate: new Date(today) },
        select: { totalRevenue: true, totalOrders: true },
      }),
      // Low stock count (live — inventory doesn't have a snapshot)
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::INT as count
        FROM inventory_items
        WHERE branch_id = ${branchId}
          AND deleted_at IS NULL
          AND low_stock_threshold > 0
          AND quantity <= low_stock_threshold
      `,
    ]);

    const statusMap: Record<string, number> = { available: 0, occupied: 0, cleaning: 0 };
    for (const row of tableStatuses as any[]) {
      statusMap[row.status] = Number(row.count);
    }

    return {
      activeOrders,
      activeSessions,
      tables: {
        available: statusMap.available,
        occupied: statusMap.occupied,
        cleaning: statusMap.cleaning,
      },
      pendingWaiterCalls,
      revenueToday: toNum(todaySnapshot?.totalRevenue),
      ordersToday: todaySnapshot?.totalOrders ?? 0,
      lowStockItems: Number((lowStockItems as any[])[0]?.count ?? 0),
    };
  },

  /**
   * GET /dashboard/branch/:branchId — Manager+
   * Returns today's daily_branch_metrics snapshot row.
   */
  async getBranchDashboard(
    branchId: number,
    restaurantId: number,
  ): Promise<BranchDashboardDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await prisma.dailyBranchMetric.findFirst({
      where: { branchId, snapshotDate: new Date(today) },
    });

    // Return zeros if no snapshot yet (first run of day, before 00:05 job)
    return {
      branchId,
      date: today,
      totalRevenue:      toNum(snapshot?.totalRevenue),
      cashRevenue:       toNum(snapshot?.cashRevenue),
      onlineRevenue:     toNum(snapshot?.onlineRevenue),
      totalOrders:       snapshot?.totalOrders ?? 0,
      cancelledOrders:   snapshot?.cancelledOrders ?? 0,
      dineinOrders:      snapshot?.dineinOrders ?? 0,
      parcelOrders:      snapshot?.parcelOrders ?? 0,
      totalSessions:     snapshot?.totalSessions ?? 0,
      totalCustomers:    snapshot?.totalCustomers ?? 0,
      avgOrderValue:     snapshot?.avgOrderValue != null ? toNum(snapshot.avgOrderValue) : null,
      completedPayments: snapshot?.completedPayments ?? 0,
    };
  },

  /**
   * GET /dashboard/admin — Admin
   * Cross-branch overview: subscription status, per-branch today snapshot, top branch.
   */
  async getAdminDashboard(restaurantId: number): Promise<AdminDashboardDto> {
    const today = new Date().toISOString().slice(0, 10);

    const [branches, subscription] = await Promise.all([
      prisma.branch.findMany({
        where: { restaurantId, deletedAt: null, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.subscription.findFirst({
        where: { restaurantId, status: { in: ['active', 'grace_period'] } },
        orderBy: { createdAt: 'desc' },
        select: { plan: true, status: true, expiresAt: true },
      }),
    ]);

    const branchIds = branches.map((b) => b.id);

    const snapshots = await prisma.dailyBranchMetric.findMany({
      where: {
        branchId: { in: branchIds },
        snapshotDate: new Date(today),
      },
      select: { branchId: true, totalRevenue: true, totalOrders: true },
    });

    const activeSessions = await prisma.diningSession.groupBy({
      by: ['branchId'],
      where: { branchId: { in: branchIds }, status: 'active' },
      _count: { id: true },
    });

    const sessionMap = Object.fromEntries(
      activeSessions.map((s) => [s.branchId, s._count.id]),
    );
    const snapshotMap = Object.fromEntries(
      snapshots.map((s) => [s.branchId, s]),
    );

    const branchSummaries = branches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      revenueToday: toNum(snapshotMap[b.id]?.totalRevenue),
      ordersToday:  snapshotMap[b.id]?.totalOrders ?? 0,
      activeSessions: sessionMap[b.id] ?? 0,
    }));

    const totalRevenueToday = branchSummaries.reduce((s, b) => s + b.revenueToday, 0);
    const topBranch = branchSummaries.reduce<typeof branchSummaries[0] | null>(
      (best, b) => (!best || b.revenueToday > best.revenueToday ? b : best),
      null,
    );

    return {
      restaurantId,
      subscription: subscription
        ? { plan: subscription.plan, status: subscription.status, expiresAt: subscription.expiresAt }
        : null,
      branches: branchSummaries,
      totalRevenueToday,
      topBranchId: topBranch?.branchId ?? null,
    };
  },
};
