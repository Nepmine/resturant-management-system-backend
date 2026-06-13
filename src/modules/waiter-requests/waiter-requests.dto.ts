export interface WaiterRequestDto {
  id: number;
  sessionId: number;
  type: string;
  status: string;
  resolvedBy: number | null;
  resolvedAt: Date | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
}
