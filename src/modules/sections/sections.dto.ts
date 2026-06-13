import { z } from 'zod';
import { createSectionSchema, updateSectionSchema } from './sections.schema';

export type CreateSectionDto = z.infer<typeof createSectionSchema>['body'];
export type UpdateSectionDto = z.infer<typeof updateSectionSchema>['body'];

export interface SectionDto {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
}
