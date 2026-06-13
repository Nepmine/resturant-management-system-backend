/** §D17 staff dashboard response */
export interface StaffDashboardDto {
  activeOrders: number;
  activeSessions: number;
  tables: {
    available: number;
    occupied: number;
    cleaning: number;
  };
  pendingWaiterCalls: number;
  revenueToday: number;
  ordersToday: number;
  lowStockItems: number;
}

/** §D17 branch manager dashboard */
export interface BranchDashboardDto {
  branchId: number;
  date: string;
  totalRevenue: number;
  cashRevenue: number;
  onlineRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  dineinOrders: number;
  parcelOrders: number;
  totalSessions: number;
  totalCustomers: number;
  avgOrderValue: number | null;
  completedPayments: number;
}

/** §D17 admin dashboard — cross-branch */
export interface AdminDashboardDto {
  restaurantId: number;
  subscription: {
    plan: string;
    status: string;
    expiresAt: Date | null;
  } | null;
  branches: Array<{
    branchId: number;
    branchName: string;
    revenueToday: number;
    ordersToday: number;
    activeSessions: number;
  }>;
  totalRevenueToday: number;
  topBranchId: number | null;
}
