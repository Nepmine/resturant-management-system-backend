import { Router } from 'express';
import { staffController } from './staff.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  staffParamSchema,
  staffListQuerySchema,
  inviteStaffSchema,
  updateRoleSchema,
  staffLogsQuerySchema,
} from './staff.schema';

const adminPipeline = [authenticate, resolveTenant, authorize('admin')];

const router = Router();

// GET /staff — Admin
router.get(
  '/',
  validate({ query: staffListQuerySchema.shape.query }),
  ...adminPipeline,
  asyncHandler(staffController.list),
);

// POST /staff/invite — Admin (must be before /:staffId)
router.post(
  '/invite',
  validate({ body: inviteStaffSchema.shape.body }),
  ...adminPipeline,
  asyncHandler(staffController.invite),
);

// PATCH /staff/:staffId/whitelist — Admin
router.patch(
  '/:staffId/whitelist',
  validate({ params: staffParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(staffController.whitelist),
);

// PATCH /staff/:staffId/suspend — Admin
router.patch(
  '/:staffId/suspend',
  validate({ params: staffParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(staffController.suspend),
);

// PATCH /staff/:staffId/role — Admin
router.patch(
  '/:staffId/role',
  validate({
    params: updateRoleSchema.shape.params,
    body: updateRoleSchema.shape.body,
  }),
  ...adminPipeline,
  asyncHandler(staffController.updateRole),
);

// GET /staff/:staffId/logs — Admin
router.get(
  '/:staffId/logs',
  validate({ params: staffLogsQuerySchema.shape.params, query: staffLogsQuerySchema.shape.query }),
  ...adminPipeline,
  asyncHandler(staffController.getLogs),
);

// DELETE /staff/:staffId — Admin (soft delete)
router.delete(
  '/:staffId',
  validate({ params: staffParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(staffController.softDelete),
);

export default router;
