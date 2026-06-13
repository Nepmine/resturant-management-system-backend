import { z } from 'zod';
import {
  createInvCategorySchema,
  updateInvCategorySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
} from './inventory.schema';

export type CreateInvCategoryDto  = z.infer<typeof createInvCategorySchema>['body'];
export type UpdateInvCategoryDto  = z.infer<typeof updateInvCategorySchema>['body'];
export type CreateInventoryItemDto = z.infer<typeof createInventoryItemSchema>['body'];
export type UpdateInventoryItemDto = z.infer<typeof updateInventoryItemSchema>['body'];
export type AdjustStockDto        = z.infer<typeof adjustStockSchema>['body'];

export interface InventoryCategoryDto {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
}

export interface InventoryItemDto {
  id: number;
  branchId: number;
  categoryId: number | null;
  name: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
}

export interface InventoryLogDto {
  id: number;
  itemId: number;
  changedBy: number;
  changeType: string;
  quantityDelta: number;
  note: string | null;
  createdAt: Date;
}
