import { z } from 'zod';
import {
  createVariantSchema,
  updateVariantSchema,
  createOptionSchema,
  updateOptionSchema,
} from './variants.schema';

export type CreateVariantDto = z.infer<typeof createVariantSchema>['body'];
export type UpdateVariantDto = z.infer<typeof updateVariantSchema>['body'];
export type CreateOptionDto  = z.infer<typeof createOptionSchema>['body'];
export type UpdateOptionDto  = z.infer<typeof updateOptionSchema>['body'];

export interface OptionDto {
  id: number;
  groupId: number;
  name: string;
  priceModifier: number;
  sortOrder: number;
}

export interface VariantGroupDto {
  id: number;
  menuItemId: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: OptionDto[];
}
