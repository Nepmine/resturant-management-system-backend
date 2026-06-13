import type { Response } from 'express';
import { categoryService } from './categories.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../../types/express';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './categories.dto';

export const categoryController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const data = await categoryService.list(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async create(req: AuthenticatedStaffRequest, res: Response) {
    const data = await categoryService.create(
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as CreateCategoryDto,
    );
    sendCreated(res, data);
  },

  async update(req: AuthenticatedStaffRequest, res: Response) {
    const data = await categoryService.update(
      Number(req.params.categoryId),
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as UpdateCategoryDto,
    );
    sendSuccess(res, data);
  },

  async reorder(req: AuthenticatedStaffRequest, res: Response) {
    const data = await categoryService.reorder(
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as ReorderCategoriesDto,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await categoryService.softDelete(
      Number(req.params.categoryId),
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendNoContent(res);
  },
};
