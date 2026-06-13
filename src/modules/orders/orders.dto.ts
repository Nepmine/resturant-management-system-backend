import { z } from 'zod';
import {
  updateOrderStatusSchema,
  cancelOrderSchema,
  cancelOrderItemSchema,
  createParcelOrderSchema,
} from './orders.schema';

export type UpdateOrderStatusDto  = z.infer<typeof updateOrderStatusSchema>['body'];
export type CancelOrderDto        = z.infer<typeof cancelOrderSchema>['body'];
export type CancelOrderItemDto    = z.infer<typeof cancelOrderItemSchema>['body'];
export type CreateParcelOrderDto  = z.infer<typeof createParcelOrderSchema>['body'];

export interface OrderItemDto {
  id: number;
  menuItemId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  status: string;
  note: string | null;
}

export interface OrderDto {
  id: number;
  sessionId: number | null;
  branchId: number;
  memberId: number | null;
  orderType: string;
  isParcel: boolean;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  note: string | null;
  acceptedByStaffId: number | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemDto[];
}
