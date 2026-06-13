import { Router } from 'express';
import { branchController } from './branches.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  createBranchSchema,
  updateBranchSchema,
  branchParamSchema,
} from './branches.schema';

const router = Router();

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];
const adminPipeline = [authenticate, resolveTenant, authorize('admin')];

// GET /branches — Staff+ (scoped by role in service)
router.get(
  '/',
  ...staffPipeline,
  asyncHandler(branchController.list),
);

// POST /branches — Admin
router.post(
  '/',
  validate({ body: createBranchSchema.shape.body }),
  ...adminPipeline,
  asyncHandler(branchController.create),
);

// GET /branches/:branchId — Staff+
router.get(
  '/:branchId',
  validate({ params: branchParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(branchController.getById),
);

// PATCH /branches/:branchId — Manager+
router.patch(
  '/:branchId',
  validate({
    params: updateBranchSchema.shape.params,
    body: updateBranchSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(branchController.update),
);

// DELETE /branches/:branchId — Admin (soft delete)
router.delete(
  '/:branchId',
  validate({ params: branchParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(branchController.softDelete),
);

// PATCH /branches/:branchId/toggle — Admin (activate/deactivate)
router.patch(
  '/:branchId/toggle',
  validate({ params: branchParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(branchController.toggle),
);

export default router;
