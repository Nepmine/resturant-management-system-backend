import { z } from 'zod';
import {
  createItemSchema,
  updateItemSchema,
  availabilitySchema,
} from './items.schema';

export type CreateItemDto       = z.infer<typeof createItemSchema>['body'];
export type UpdateItemDto       = z.infer<typeof updateItemSchema>['body'];
export type AvailabilityDto     = z.infer<typeof availabilitySchema>['body'];

export interface OptionDto {
  id: number;
  groupId: number;
  name: string;
  priceModifier: number;
  sortOrder: number;
}

export interface OptionGroupDto {
  id: number;
  menuItemId: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: OptionDto[];
}

export interface MenuItemDto {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isAvailable: boolean;
  disableNote: string | null;
  sortOrder: number;
  createdAt: Date;
  optionGroups?: OptionGroupDto[];
}
