import { z } from 'zod';
import { qrScanSchema } from './qr.schema';

export type QrScanDto = z.infer<typeof qrScanSchema>['body'];

export interface QrScanResponseDto {
  memberToken: string;
  session: {
    id: number;
    status: string;
    tableId: number;
    tableNumber: number;
    tableLabel: string | null;
    sectionName: string;
    branchId: number;
    branchName: string;
    /** Whether this scan created a new session or joined an existing one. */
    isNew: boolean;
  };
  memberId: number;
  menuUrl: string;
}
