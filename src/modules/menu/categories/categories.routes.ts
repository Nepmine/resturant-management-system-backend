import { Router } from 'express';
import { categoryController } from './categories.controller';
import { asyncHandler } from '../../../middleware/errorHandler';
import { validate } from '../../../middleware/validate';
import { authenticate } from '../../../middleware/auth';
import { authorize } from '../../../middleware/authorize';
import { resolveTenant } from '../../../middleware/tenant';
import {
  categoryBranchParamSchema,
  categoryParamSchema,
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from './categories.schema';

// Mounted under /branches/:branchId/menu/categories in app.ts (mergeParams: true)
const router = Router({ mergeParams: true });

const staffPipeline   = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];

// GET /branches/:branchId/menu/categories — Staff+
router.get(
  '/',
  validate({ params: categoryBranchParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(categoryController.list),
);

// POST /branches/:branchId/menu/categories — Manager+
router.post(
  '/',
  validate({
    params: createCategorySchema.shape.params,
    body: createCategorySchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(categoryController.create),
);

// PATCH /branches/:branchId/menu/categories/reorder — Manager+
// Must be declared BEFORE /:categoryId to avoid route shadowing
router.patch(
  '/reorder',
  validate({
    params: reorderCategoriesSchema.shape.params,
    body: reorderCategoriesSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(categoryController.reorder),
);

// PATCH /branches/:branchId/menu/categories/:categoryId — Manager+
router.patch(
  '/:categoryId',
  validate({
    params: updateCategorySchema.shape.params,
    body: updateCategorySchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(categoryController.update),
);

// DELETE /branches/:branchId/menu/categories/:categoryId — Manager+
router.delete(
  '/:categoryId',
  validate({ params: categoryParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(categoryController.softDelete),
);

export default router;
