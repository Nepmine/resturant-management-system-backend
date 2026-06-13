export interface RevenueAnalyticsDto {
  period: { from: string; to: string };
  totalRevenue: number;
  cashRevenue: number;
  onlineRevenue: number;
  dineinRevenue: number;
  parcelRevenue: number;
  byDay: Array<{ date: string; revenue: number }>;
}

export interface OrderAnalyticsDto {
  period: { from: string; to: string };
  totalOrders: number;
  cancelledOrders: number;
  dineinOrders: number;
  parcelOrders: number;
  byDay: Array<{ date: string; orders: number }>;
}

export interface PaymentAnalyticsDto {
  period: { from: string; to: string };
  cashRevenue: number;
  onlineRevenue: number;
  completedPayments: number;
  cashPercentage: number;
  onlinePercentage: number;
}

export interface PeakHoursDto {
  branchId: number;
  /** Hourly order counts for the last 30 days (0–23) */
  hours: Array<{ hour: number; orderCount: number }>;
}

export interface TopDishDto {
  menuItemId: number;
  name: string;
  quantitySold: number;
  revenueGenerated: number;
}

export interface DishSalesDto {
  menuItemId: number;
  name: string;
  quantitySold: number;
  revenueGenerated: number;
}

export interface TableUtilizationDto {
  tableId: number;
  tableNumber: number;
  sectionName: string;
  sessionCount: number;
  avgOccupancyMinutes: number | null;
}

export interface SessionDurationDto {
  period: { from: string; to: string };
  avgDurationMinutes: number | null;
  totalSessions: number;
}

export interface CustomerTrendsDto {
  period: { from: string; to: string };
  totalCustomers: number;
  avgPartySize: number | null;
  byDay: Array<{ date: string; customers: number }>;
}

export interface StaffPerformanceDto {
  staffId: number;
  staffName: string;
  ordersHandled: number;
  salesAmount: number;
  cancelledOrders: number;
  avgOrderCompletionSeconds: number | null;
}

export interface BranchComparisonDto {
  branchId: number;
  branchName: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number | null;
}
