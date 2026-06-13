import { z } from 'zod';
import { createTableSchema, updateTableSchema } from './tables.schema';

export type CreateTableDto = z.infer<typeof createTableSchema>['body'];
export type UpdateTableDto  = z.infer<typeof updateTableSchema>['body'];

export interface TableDto {
  id: number;
  branchId: number;
  sectionId: number;
  tableNumber: number;
  label: string | null;
  status: string;
  /** qr_token is included only for manager+ responses (QR SVG endpoint returns it separately). */
  qrToken?: string;
  createdAt: Date;
}

export interface QrDataDto {
  tableId: number;
  tableNumber: number;
  qrToken: string;
  /** SVG string rendered server-side. */
  svg: string;
}
