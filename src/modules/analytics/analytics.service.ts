import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { resolvePeriod, toDateStr } from './analytics.period';
import type {
  RevenueAnalyticsDto,
  OrderAnalyticsDto,
  PaymentAnalyticsDto,
  PeakHoursDto,
  TopDishDto,
  DishSalesDto,
  TableUtilizationDto,
  SessionDurationDto,
  CustomerTrendsDto,
  StaffPerformanceDto,
  BranchComparisonDto,
} from './analytics.dto';

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object' && 'toNumber' in (v as any)) return (v as any).toNumber();
  return Number(v);
}

async function assertBranch(branchId: number, restaurantId: number) {
  const b = await branchRepository.findById(branchId, restaurantId);
  if (!b) throw new AppError('Branch not found', 404, 'NOT_FOUND');
}

/** Fetches daily_branch_metrics rows for the given branch + date range. */
async function getBranchSnapshots(branchId: number, from: Date, to: Date) {
  return prisma.dailyBranchMetrics.findMany({
    where: {
      branchId,
      snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
    },
    orderBy: { snapshotDate: 'asc' },
  });
}

export const analyticsService = {
  // ─── Revenue ─────────────────────────────────────────────────────────────

  async getRevenue(branchId: number, restaurantId: number, query: any): Promise<RevenueAnalyticsDto> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);
    const rows = await getBranchSnapshots(branchId, from, to);

    const total       = rows.reduce((s, r) => s + toNum(r.totalRevenue),  0);
    const cash        = rows.reduce((s, r) => s + toNum(r.cashRevenue),   0);
    const online      = rows.reduce((s, r) => s + toNum(r.onlineRevenue), 0);
    // §D18: dine-in / parcel revenue derived from orders * avg — stored as order counts only.
    // We approximate from order proportions × total revenue for this endpoint.
    const totalOrders = rows.reduce((s, r) => s + r.totalOrders, 0);
    const dineinOrders = rows.reduce((s, r) => s + r.dineinOrders, 0);
    const parcelOrders = rows.reduce((s, r) => s + r.parcelOrders, 0);
    const dineinRatio  = totalOrders > 0 ? dineinOrders / totalOrders : 0;
    const parcelRatio  = totalOrders > 0 ? parcelOrders / totalOrders : 0;

    return {
      period: { from: toDateStr(from), to: toDateStr(to) },
      totalRevenue: total,
      cashRevenue: cash,
      onlineRevenue: online,
      dineinRevenue: +(total * dineinRatio).toFixed(2),
      parcelRevenue: +(total * parcelRatio).toFixed(2),
      byDay: rows.map((r) => ({
        date: toDateStr(r.snapshotDate),
        revenue: toNum(r.totalRevenue),
      })),
    };
  },

  // ─── Orders ──────────────────────────────────────────────────────────────

  async getOrders(branchId: number, restaurantId: number, query: any): Promise<OrderAnalyticsDto> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);
    const rows = await getBranchSnapshots(branchId, from, to);

    return {
      period: { from: toDateStr(from), to: toDateStr(to) },
      totalOrders:     rows.reduce((s, r) => s + r.totalOrders,     0),
      cancelledOrders: rows.reduce((s, r) => s + r.cancelledOrders, 0),
      dineinOrders:    rows.reduce((s, r) => s + r.dineinOrders,    0),
      parcelOrders:    rows.reduce((s, r) => s + r.parcelOrders,    0),
      byDay: rows.map((r) => ({
        date: toDateStr(r.snapshotDate),
        orders: r.totalOrders,
      })),
    };
  },

  // ─── Payments ────────────────────────────────────────────────────────────

  async getPayments(branchId: number, restaurantId: number, query: any): Promise<PaymentAnalyticsDto> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);
    const rows = await getBranchSnapshots(branchId, from, to);

    const cash   = rows.reduce((s, r) => s + toNum(r.cashRevenue),   0);
    const online = rows.reduce((s, r) => s + toNum(r.onlineRevenue), 0);
    const total  = cash + online;
    const completed = rows.reduce((s, r) => s + r.completedPayments, 0);

    return {
      period: { from: toDateStr(from), to: toDateStr(to) },
      cashRevenue: cash,
      onlineRevenue: online,
      completedPayments: completed,
      cashPercentage:   total > 0 ? +((cash   / total) * 100).toFixed(1) : 0,
      onlinePercentage: total > 0 ? +((online / total) * 100).toFixed(1) : 0,
    };
  },

  // ─── Peak hours (raw orders — §D18 exception) ────────────────────────────

  async getPeakHours(branchId: number, restaurantId: number): Promise<PeakHoursDto> {
    await assertBranch(branchId, restaurantId);

    // §D18: peak-hours queries raw orders grouped by EXTRACT(HOUR FROM created_at)
    // using (branch_id, created_at) index — last 30 days only.
    const rows = await prisma.$queryRaw<Array<{ hour: number; order_count: bigint }>>`
      SELECT EXTRACT(HOUR FROM created_at)::INT AS hour,
             COUNT(*)::INT AS order_count
      FROM orders
      WHERE branch_id = ${branchId}
        AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY hour
      ORDER BY hour ASC
    `;

    // Fill all 24 hours (0–23), defaulting missing hours to 0
    const hourMap = Object.fromEntries(
      (rows as any[]).map((r) => [r.hour, Number(r.order_count)]),
    );
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      orderCount: hourMap[h] ?? 0,
    }));

    return { branchId, hours };
  },

  // ─── Top dishes ───────────────────────────────────────────────────────────

  async getTopDishes(branchId: number, restaurantId: number, query: any): Promise<TopDishDto[]> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);
    const limit = Number(query.limit ?? 10);

    const rows = await prisma.dailyItemMetrics.groupBy({
      by: ['menuItemId'],
      where: {
        branchId,
        snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
      },
      _sum: { quantitySold: true, revenueGenerated: true },
      orderBy: { _sum: { quantitySold: 'desc' } },
      take: limit,
    });

    const itemIds = rows.map((r) => r.menuItemId);
    const items = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(items.map((i) => [i.id, i.name]));

    return rows.map((r) => ({
      menuItemId: r.menuItemId,
      name: nameMap[r.menuItemId] ?? 'Unknown',
      quantitySold: r._sum.quantitySold ?? 0,
      revenueGenerated: toNum(r._sum.revenueGenerated),
    }));
  },

  // ─── Worst dishes ────────────────────────────────────────────────────────

  async getWorstDishes(branchId: number, restaurantId: number, query: any): Promise<TopDishDto[]> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);
    const limit = Number(query.limit ?? 10);

    const rows = await prisma.dailyItemMetrics.groupBy({
      by: ['menuItemId'],
      where: {
        branchId,
        snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
      },
      _sum: { quantitySold: true, revenueGenerated: true },
      orderBy: { _sum: { quantitySold: 'asc' } },
      take: limit,
    });

    const itemIds = rows.map((r) => r.menuItemId);
    const items   = await prisma.menuItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } });
    const nameMap = Object.fromEntries(items.map((i) => [i.id, i.name]));

    return rows.map((r) => ({
      menuItemId: r.menuItemId,
      name: nameMap[r.menuItemId] ?? 'Unknown',
      quantitySold: r._sum.quantitySold ?? 0,
      revenueGenerated: toNum(r._sum.revenueGenerated),
    }));
  },

  // ─── Dish sales breakdown ─────────────────────────────────────────────────

  async getDishSales(branchId: number, restaurantId: number, query: any): Promise<DishSalesDto[]> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);

    const rows = await prisma.dailyItemMetrics.groupBy({
      by: ['menuItemId'],
      where: {
        branchId,
        snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
      },
      _sum: { quantitySold: true, revenueGenerated: true },
      orderBy: { _sum: { revenueGenerated: 'desc' } },
    });

    const itemIds = rows.map((r) => r.menuItemId);
    const items   = await prisma.menuItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } });
    const nameMap = Object.fromEntries(items.map((i) => [i.id, i.name]));

    return rows.map((r) => ({
      menuItemId: r.menuItemId,
      name: nameMap[r.menuItemId] ?? 'Unknown',
      quantitySold: r._sum.quantitySold ?? 0,
      revenueGenerated: toNum(r._sum.revenueGenerated),
    }));
  },

  // ─── Table utilization ────────────────────────────────────────────────────

  async getTableUtilization(branchId: number, restaurantId: number, query: any): Promise<TableUtilizationDto[]> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);

    const rows = await prisma.$queryRaw<Array<{
      table_id: number; table_number: number; section_name: string;
      session_count: bigint; avg_minutes: number | null;
    }>>`
      SELECT
        t.id AS table_id,
        t.table_number,
        s.name AS section_name,
        COUNT(ds.id)::INT AS session_count,
        AVG(EXTRACT(EPOCH FROM (COALESCE(ds.completed_at, NOW()) - ds.started_at)) / 60)::NUMERIC(10,1) AS avg_minutes
      FROM tables t
      JOIN sections s ON s.id = t.section_id
      LEFT JOIN dining_sessions ds
        ON ds.table_id = t.id
        AND ds.started_at BETWEEN ${from} AND ${to}
      WHERE t.branch_id = ${branchId} AND t.deleted_at IS NULL
      GROUP BY t.id, t.table_number, s.name
      ORDER BY session_count DESC
    `;

    return (rows as any[]).map((r) => ({
      tableId: r.table_id,
      tableNumber: r.table_number,
      sectionName: r.section_name,
      sessionCount: Number(r.session_count),
      avgOccupancyMinutes: r.avg_minutes !== null ? Number(r.avg_minutes) : null,
    }));
  },

  // ─── Session duration ─────────────────────────────────────────────────────

  async getSessionDuration(branchId: number, restaurantId: number, query: any): Promise<SessionDurationDto> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);

    const rows = await prisma.dailyBranchMetrics.findMany({
      where: {
        branchId,
        snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
      },
      select: { totalSessions: true },
    });
    const totalSessions = rows.reduce((s, r) => s + r.totalSessions, 0);

    // Avg duration computed from raw sessions (no snapshot for this)
    const result = await prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::NUMERIC(10,1) AS avg_minutes
      FROM dining_sessions
      WHERE branch_id = ${branchId}
        AND status = 'completed'
        AND started_at BETWEEN ${from} AND ${to}
    `;

    return {
      period: { from: toDateStr(from), to: toDateStr(to) },
      avgDurationMinutes: result[0]?.avg_minutes != null ? Number(result[0].avg_minutes) : null,
      totalSessions,
    };
  },

  // ─── Customer trends ──────────────────────────────────────────────────────

  async getCustomerTrends(branchId: number, restaurantId: number, query: any): Promise<CustomerTrendsDto> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);
    const rows = await getBranchSnapshots(branchId, from, to);

    const totalCustomers = rows.reduce((s, r) => s + r.totalCustomers, 0);
    const totalSessions  = rows.reduce((s, r) => s + r.totalSessions,  0);
    const avgPartySize   = totalSessions > 0
      ? +(totalCustomers / totalSessions).toFixed(1)
      : null;

    return {
      period: { from: toDateStr(from), to: toDateStr(to) },
      totalCustomers,
      avgPartySize,
      byDay: rows.map((r) => ({
        date: toDateStr(r.snapshotDate),
        customers: r.totalCustomers,
      })),
    };
  },

  // ─── Staff performance ────────────────────────────────────────────────────

  async getStaffPerformance(branchId: number, restaurantId: number, query: any): Promise<StaffPerformanceDto[]> {
    await assertBranch(branchId, restaurantId);
    const { from, to } = resolvePeriod(query);

    const rows = await prisma.staffDailyMetrics.groupBy({
      by: ['staffId'],
      where: {
        branchId,
        snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
      },
      _sum: { ordersHandled: true, salesAmount: true, cancelledOrders: true },
      _avg: { avgOrderCompletionSeconds: true },
      orderBy: { _sum: { salesAmount: 'desc' } },
    });

    const staffIds = rows.map((r) => r.staffId);
    const staffList = await prisma.staffUser.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(staffList.map((s) => [s.id, s.name]));

    return rows.map((r) => ({
      staffId: r.staffId,
      staffName: nameMap[r.staffId] ?? 'Unknown',
      ordersHandled: r._sum.ordersHandled ?? 0,
      salesAmount: toNum(r._sum.salesAmount),
      cancelledOrders: r._sum.cancelledOrders ?? 0,
      avgOrderCompletionSeconds: r._avg.avgOrderCompletionSeconds != null
        ? Math.round(Number(r._avg.avgOrderCompletionSeconds))
        : null,
    }));
  },

  // ─── Branch comparison (Admin) ────────────────────────────────────────────

  async getBranchComparison(restaurantId: number, query: any): Promise<BranchComparisonDto[]> {
    const { from, to } = resolvePeriod(query);

    const branches = await prisma.branch.findMany({
      where: { restaurantId, deletedAt: null },
      select: { id: true, name: true },
    });

    const rows = await prisma.dailyBranchMetrics.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: branches.map((b) => b.id) },
        snapshotDate: { gte: new Date(toDateStr(from)), lte: new Date(toDateStr(to)) },
      },
      _sum: { totalRevenue: true, totalOrders: true },
      _avg: { avgOrderValue: true },
    });

    const nameMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

    return rows.map((r) => ({
      branchId: r.branchId,
      branchName: nameMap[r.branchId] ?? 'Unknown',
      totalRevenue: toNum(r._sum.totalRevenue),
      totalOrders: r._sum.totalOrders ?? 0,
      avgOrderValue: r._avg.avgOrderValue != null ? toNum(r._avg.avgOrderValue) : null,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },
};
