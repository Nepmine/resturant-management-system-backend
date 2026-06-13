import { z } from 'zod';
import { refundSchema } from './payments.schema';

export type RefundDto = z.infer<typeof refundSchema>['body'];

export interface PaymentDto {
  id: number;
  sessionId: number;
  orderId: number | null;
  memberId: number | null;
  amount: number;
  method: string;
  status: string;
  esewaRefId: string | null;
  esewaPid: string | null;
  paidAt: Date | null;
  createdAt: Date;
}
