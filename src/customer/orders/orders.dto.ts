import { z } from 'zod';
import { placeOrderSchema, addItemsSchema } from './orders.schema';

export type PlaceOrderDto  = z.infer<typeof placeOrderSchema>['body'];
export type AddItemsDto    = z.infer<typeof addItemsSchema>['body'];

// Customer-facing shape — mirrors staff OrderDto but no internal staff fields
export interface CustomerOrderItemDto {
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

export interface CustomerOrderDto {
  id: number;
  sessionId: number;
  orderType: string;
  status: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: CustomerOrderItemDto[];
  subtotal: number;
}
