import { Router } from 'express';
import { variantController } from './variants.controller';
import { asyncHandler } from '../../../middleware/errorHandler';
import { validate } from '../../../middleware/validate';
import { authenticate } from '../../../middleware/auth';
import { authorize } from '../../../middleware/authorize';
import { resolveTenant } from '../../../middleware/tenant';
import {
  variantItemParamSchema,
  variantParamSchema,
  createVariantSchema,
  updateVariantSchema,
  optionParamSchema,
  createOptionSchema,
  updateOptionSchema,
} from './variants.schema';

// Mounted under /menu/items/:itemId/variants in app.ts (mergeParams: true)
const router = Router({ mergeParams: true });

const managerPipeline = [authenticate, resolveTenant, authorize('manager')];

// ─── Group-level routes ─────────────────────────────────────────────────────

// POST /menu/items/:itemId/variants — Manager+
router.post(
  '/',
  validate({
    params: createVariantSchema.shape.params,
    body: createVariantSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(variantController.createGroup),
);

// PATCH /menu/items/:itemId/variants/:variantId — Manager+
router.patch(
  '/:variantId',
  validate({
    params: updateVariantSchema.shape.params,
    body: updateVariantSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(variantController.updateGroup),
);

// DELETE /menu/items/:itemId/variants/:variantId — Manager+
router.delete(
  '/:variantId',
  validate({ params: variantParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(variantController.softDeleteGroup),
);

// ─── Option-level routes (within a group) ──────────────────────────────────

// POST /menu/items/:itemId/variants/:variantId/options — Manager+
router.post(
  '/:variantId/options',
  validate({
    params: createOptionSchema.shape.params,
    body: createOptionSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(variantController.createOption),
);

// PATCH /menu/items/:itemId/variants/:variantId/options/:optionId — Manager+
router.patch(
  '/:variantId/options/:optionId',
  validate({
    params: updateOptionSchema.shape.params,
    body: updateOptionSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(variantController.updateOption),
);

// DELETE /menu/items/:itemId/variants/:variantId/options/:optionId — Manager+
router.delete(
  '/:variantId/options/:optionId',
  validate({ params: optionParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(variantController.softDeleteOption),
);

export default router;
