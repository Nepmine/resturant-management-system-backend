import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import { dashboardBranchParamSchema } from './dashboard.schema';

const staffPipeline   = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];
const adminPipeline   = [authenticate, resolveTenant, authorize('admin')];

const router = Router();

// GET /dashboard — Staff+ (operational view for current branch)
router.get('/', ...staffPipeline, asyncHandler(dashboardController.getStaffDashboard));

// GET /dashboard/admin — Admin (must be before /branch/:branchId)
router.get('/admin', ...adminPipeline, asyncHandler(dashboardController.getAdminDashboard));

// GET /dashboard/branch/:branchId — Manager+
router.get(
  '/branch/:branchId',
  validate({ params: dashboardBranchParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(dashboardController.getBranchDashboard),
);

export default router;
