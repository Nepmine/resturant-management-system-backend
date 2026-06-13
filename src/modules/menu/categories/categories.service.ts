import prisma from '../../../config/database';
import { AppError } from '../../../middleware/errorHandler';
import { branchRepository } from '../../branches/branches.repository';
import { categoryRepository } from './categories.repository';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
  CategoryDto,
} from './categories.dto';

function formatCategory(c: {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
}): CategoryDto {
  return {
    id: c.id,
    branchId: c.branchId,
    name: c.name,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt,
  };
}

async function assertBranch(branchId: number, restaurantId: number) {
  const b = await branchRepository.findById(branchId, restaurantId);
  if (!b) throw new AppError('Branch not found', 404, 'NOT_FOUND');
}

async function assertCategory(categoryId: number, branchId: number) {
  const c = await categoryRepository.findById(categoryId, branchId);
  if (!c) throw new AppError('Category not found', 404, 'NOT_FOUND');
  return c;
}

export const categoryService = {
  async list(branchId: number, restaurantId: number): Promise<CategoryDto[]> {
    await assertBranch(branchId, restaurantId);
    const cats = await categoryRepository.findAll(branchId);
    return cats.map(formatCategory);
  },

  async create(
    branchId: number,
    restaurantId: number,
    dto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    await assertBranch(branchId, restaurantId);
    const cat = await categoryRepository.create({ branchId, ...dto });
    return formatCategory(cat);
  },

  async update(
    categoryId: number,
    branchId: number,
    restaurantId: number,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    await assertBranch(branchId, restaurantId);
    await assertCategory(categoryId, branchId);
    const updated = await categoryRepository.update(categoryId, dto);
    return formatCategory(updated);
  },

  /**
   * PATCH /menu/categories/reorder — bulk sort_order update.
   * All provided IDs must belong to the same branch; unknown IDs are rejected.
   */
  async reorder(
    branchId: number,
    restaurantId: number,
    dto: ReorderCategoriesDto,
  ): Promise<CategoryDto[]> {
    await assertBranch(branchId, restaurantId);

    return prisma.$transaction(async (tx) => {
      // Verify every submitted id belongs to this branch
      for (const item of dto.order) {
        const cat = await categoryRepository.findById(item.id, branchId, tx);
        if (!cat) {
          throw new AppError(
            `Category ${item.id} not found in this branch`,
            404,
            'NOT_FOUND',
          );
        }
      }

      await categoryRepository.bulkUpdateSortOrder(dto.order, tx);

      const updated = await categoryRepository.findAll(branchId, tx);
      return updated.map(formatCategory);
    });
  },

  async softDelete(
    categoryId: number,
    branchId: number,
    restaurantId: number,
  ): Promise<void> {
    await assertBranch(branchId, restaurantId);
    await assertCategory(categoryId, branchId);

    const hasItems = await categoryRepository.hasActiveItems(categoryId);
    if (hasItems) {
      throw new AppError(
        'Cannot delete category: it still has active menu items. Remove or reassign items first.',
        409,
        'CATEGORY_HAS_ITEMS',
      );
    }

    await categoryRepository.softDelete(categoryId);
  },
};
