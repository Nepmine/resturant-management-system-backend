import { Router } from 'express';
import { sectionController } from './sections.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  sectionBranchParamSchema,
  sectionParamSchema,
  createSectionSchema,
  updateSectionSchema,
} from './sections.schema';

// Mounted under /branches/:branchId/sections in app.ts  (mergeParams: true)
const router = Router({ mergeParams: true });

const staffPipeline    = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline  = [authenticate, resolveTenant, authorize('manager')];

// GET /branches/:branchId/sections — Staff+
router.get(
  '/',
  validate({ params: sectionBranchParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(sectionController.list),
);

// POST /branches/:branchId/sections — Manager+
router.post(
  '/',
  validate({
    params: createSectionSchema.shape.params,
    body: createSectionSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(sectionController.create),
);

// PATCH /branches/:branchId/sections/:sectionId — Manager+
router.patch(
  '/:sectionId',
  validate({
    params: updateSectionSchema.shape.params,
    body: updateSectionSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(sectionController.update),
);

// DELETE /branches/:branchId/sections/:sectionId — Manager+
router.delete(
  '/:sectionId',
  validate({ params: sectionParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(sectionController.softDelete),
);

export default router;
