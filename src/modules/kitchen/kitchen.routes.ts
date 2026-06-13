import { Router } from 'express';
import { kitchenController } from './kitchen.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  kitchenBranchParamSchema,
  kitchenQuerySchema,
  orderItemParamSchema,
} from './kitchen.schema';

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];

// ─── Branch-nested KDS views: /branches/:branchId/kitchen/* ───────────────
export const branchKitchenRouter = Router({ mergeParams: true });

// GET /branches/:branchId/kitchen/orders — Staff+ (full KDS board)
branchKitchenRouter.get(
  '/orders',
  validate({
    params: kitchenBranchParamSchema.shape.params,
    query: kitchenQuerySchema.shape.query,
  }),
  ...staffPipeline,
  asyncHandler(kitchenController.getOrders),
);

// GET /branches/:branchId/kitchen/queue — Staff+ (pending + preparing only)
branchKitchenRouter.get(
  '/queue',
  validate({
    params: kitchenBranchParamSchema.shape.params,
    query: kitchenQuerySchema.shape.query,
  }),
  ...staffPipeline,
  asyncHandler(kitchenController.getQueue),
);

// ─── Root-level item transitions: /order-items/:itemId/* ──────────────────
// §D12: Item status transitions live at /order-items/:itemId
const orderItemsRouter = Router();

// PATCH /order-items/:itemId/preparing — Staff+
orderItemsRouter.patch(
  '/:itemId/preparing',
  validate({ params: orderItemParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(kitchenController.markPreparing),
);

// PATCH /order-items/:itemId/ready — Staff+
orderItemsRouter.patch(
  '/:itemId/ready',
  validate({ params: orderItemParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(kitchenController.markReady),
);

// PATCH /order-items/:itemId/delivered — Staff+
orderItemsRouter.patch(
  '/:itemId/delivered',
  validate({ params: orderItemParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(kitchenController.markDelivered),
);

export default orderItemsRouter;
