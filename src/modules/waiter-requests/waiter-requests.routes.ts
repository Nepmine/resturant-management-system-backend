import { Router } from 'express';
import { waiterRequestController } from './waiter-requests.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  waiterRequestBranchParamSchema,
  waiterRequestParamSchema,
  waiterRequestListQuerySchema,
} from './waiter-requests.schema';

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];

// ─── Branch-nested: /branches/:branchId/waiter-requests ───────────────────
export const branchWaiterRequestsRouter = Router({ mergeParams: true });

branchWaiterRequestsRouter.get(
  '/',
  validate({
    params: waiterRequestBranchParamSchema.shape.params,
    query: waiterRequestListQuerySchema.shape.query,
  }),
  ...staffPipeline,
  asyncHandler(waiterRequestController.list),
);

// ─── Root-level: /waiter-requests/:requestId/* ────────────────────────────
const waiterRequestsRouter = Router();

waiterRequestsRouter.patch(
  '/:requestId/acknowledge',
  validate({ params: waiterRequestParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(waiterRequestController.acknowledge),
);

waiterRequestsRouter.patch(
  '/:requestId/resolve',
  validate({ params: waiterRequestParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(waiterRequestController.resolve),
);

export default waiterRequestsRouter;
