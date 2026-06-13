export interface SessionMemberDto {
  id: number;
  name: string;
  phone: string | null;
  joinedAt: Date;
}

export interface SessionSummaryDto {
  id: number;
  tableId: number;
  tableNumber: number;
  tableLabel: string | null;
  sectionName: string;
  branchId: number;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  memberCount: number;
}

export interface SessionDetailDto extends SessionSummaryDto {
  members: SessionMemberDto[];
  orderCount: number;
  totalRevenue: number;
}
