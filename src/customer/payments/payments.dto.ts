import { z } from 'zod';
import { initiatePaymentSchema, esewaInitiateSchema } from './payments.schema';

export type InitiatePaymentDto  = z.infer<typeof initiatePaymentSchema>['body'];
export type EsewaInitiateDto    = z.infer<typeof esewaInitiateSchema>['body'];

export interface CustomerPaymentDto {
  id: number;
  amount: number;
  method: string;
  status: string;
  esewaRefId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface EsewaFormParamsDto {
  paymentId: number;
  esewaPid: string;
  formParams: Record<string, number | string>;
}
