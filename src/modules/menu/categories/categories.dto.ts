import { z } from 'zod';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from './categories.schema';

export type CreateCategoryDto   = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryDto   = z.infer<typeof updateCategorySchema>['body'];
export type ReorderCategoriesDto = z.infer<typeof reorderCategoriesSchema>['body'];

export interface CategoryDto {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
}
