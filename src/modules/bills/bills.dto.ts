import { z } from 'zod';
import { createBillSchema, updateBillSchema } from './bills.schema';

export type CreateBillDto = z.infer<typeof createBillSchema>['body'];
export type UpdateBillDto = z.infer<typeof updateBillSchema>['body'];

export interface BillDto {
  id: number;
  branchId: number;
  type: string;
  status: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  note: string | null;
  createdAt: Date;
}
