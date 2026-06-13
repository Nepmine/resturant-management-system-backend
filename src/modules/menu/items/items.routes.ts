import { Router } from 'express';
import { itemController } from './items.controller';
import { asyncHandler } from '../../../middleware/errorHandler';
import { validate } from '../../../middleware/validate';
import { authenticate } from '../../../middleware/auth';
import { authorize } from '../../../middleware/authorize';
import { resolveTenant } from '../../../middleware/tenant';
import {
  itemCategoryParamSchema,
  itemParamSchema,
  createItemSchema,
  updateItemSchema,
  availabilitySchema,
} from './items.schema';

const staffPipeline   = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];

// ─── Category-nested router: /menu/categories/:categoryId/items ────────────
// Mounted with mergeParams: true in app.ts
export const categoryItemsRouter = Router({ mergeParams: true });

// POST /menu/categories/:categoryId/items — Manager+
categoryItemsRouter.post(
  '/',
  validate({
    params: createItemSchema.shape.params,
    body: createItemSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(itemController.create),
);

// ─── Root-level item router: /menu/items/:itemId ───────────────────────────
// Mounted at /menu/items in app.ts
const itemsRouter = Router();

// GET /menu/items/:itemId — Staff+
itemsRouter.get(
  '/:itemId',
  validate({ params: itemParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(itemController.getById),
);

// PATCH /menu/items/:itemId — Manager+
// Availability sub-route must come BEFORE /:itemId to avoid shadowing
itemsRouter.patch(
  '/:itemId/availability',
  validate({
    params: availabilitySchema.shape.params,
    body: availabilitySchema.shape.body,
  }),
  ...staffPipeline,          // availability toggle is Staff+ per §D7
  asyncHandler(itemController.setAvailability),
);

// PATCH /menu/items/:itemId — Manager+
itemsRouter.patch(
  '/:itemId',
  validate({
    params: updateItemSchema.shape.params,
    body: updateItemSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(itemController.update),
);

// DELETE /menu/items/:itemId — Manager+
itemsRouter.delete(
  '/:itemId',
  validate({ params: itemParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(itemController.softDelete),
);

export default itemsRouter;
