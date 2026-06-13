import { z } from 'zod';
import { createBranchSchema, updateBranchSchema } from './branches.schema';

export type CreateBranchDto = z.infer<typeof createBranchSchema>['body'];
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>['body'];

export interface BranchDto {
  id: number;
  restaurantId: number;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
}
