import { Router } from 'express';
import { restaurantController } from './restaurants.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  createRestaurantSchema,
  updateRestaurantSchema,
  restaurantParamSchema,
} from './restaurants.schema';

const router = Router();

// POST /restaurants — public onboarding
router.post(
  '/',
  validate({ body: createRestaurantSchema.shape.body }),
  asyncHandler(restaurantController.create),
);

// GET /restaurants/:id — Admin
router.get(
  '/:id',
  validate({ params: restaurantParamSchema.shape.params }),
  authenticate,
  resolveTenant,
  authorize('admin'),
  asyncHandler(restaurantController.getById),
);

// PATCH /restaurants/:id — Admin
router.patch(
  '/:id',
  validate({
    params: updateRestaurantSchema.shape.params,
    body: updateRestaurantSchema.shape.body,
  }),
  authenticate,
  resolveTenant,
  authorize('admin'),
  asyncHandler(restaurantController.update),
);

// DELETE /restaurants/:id — Admin (soft delete)
router.delete(
  '/:id',
  validate({ params: restaurantParamSchema.shape.params }),
  authenticate,
  resolveTenant,
  authorize('admin'),
  asyncHandler(restaurantController.softDelete),
);

export default router;
