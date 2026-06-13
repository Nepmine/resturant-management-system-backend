export interface CustomerSessionDto {
  id: number;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  table: {
    id: number;
    tableNumber: number;
    label: string | null;
    sectionName: string;
  };
  members: Array<{
    id: number;
    name: string;
    joinedAt: Date;
  }>;
  memberCount: number;
}
