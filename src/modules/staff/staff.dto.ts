import { z } from 'zod';
import { inviteStaffSchema, updateRoleSchema } from './staff.schema';

export type InviteStaffDto   = z.infer<typeof inviteStaffSchema>['body'];
export type UpdateRoleDto    = z.infer<typeof updateRoleSchema>['body'];

export interface StaffDto {
  id: number;
  name: string;
  email: string;
  role: string;
  branchId: number | null;
  isActive: boolean;
  oauthProvider: string;
  createdAt: Date;
}

export interface ActivityLogDto {
  id: number;
  staffId: number;
  branchId: number | null;
  actionType: string;
  targetType: string;
  targetId: number;
  meta: unknown;
  createdAt: Date;
}
