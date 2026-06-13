import { Router } from 'express';
import { orderController } from './orders.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  orderBranchParamSchema,
  orderParamSchema,
  orderItemParamSchema,
  orderListQuerySchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  cancelOrderItemSchema,
  createParcelOrderSchema,
} from './orders.schema';

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];

// ─── Branch-nested: GET /branches/:branchId/orders ────────────────────────
export const branchOrdersRouter = Router({ mergeParams: true });

branchOrdersRouter.get(
  '/',
  validate({
    params: orderBranchParamSchema.shape.params,
    query: orderListQuerySchema.shape.query,
  }),
  ...staffPipeline,
  asyncHandler(orderController.list),
);

// ─── Root-level order actions: /orders/* ──────────────────────────────────
const ordersRouter = Router();

// POST /orders/parcel — Staff+ (must be before /:orderId)
ordersRouter.post(
  '/parcel',
  validate({ body: createParcelOrderSchema.shape.body }),
  ...staffPipeline,
  asyncHandler(orderController.createParcel),
);

// GET /orders/:orderId — Staff+
ordersRouter.get(
  '/:orderId',
  validate({ params: orderParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(orderController.getById),
);

// PATCH /orders/:orderId/status — Staff+
// §F4: Only pending → confirmed allowed here; KDS handles further transitions
ordersRouter.patch(
  '/:orderId/status',
  validate({
    params: updateOrderStatusSchema.shape.params,
    body: updateOrderStatusSchema.shape.body,
  }),
  ...staffPipeline,
  asyncHandler(orderController.updateStatus),
);

// PATCH /orders/:orderId/cancel — Staff+
ordersRouter.patch(
  '/:orderId/cancel',
  validate({
    params: cancelOrderSchema.shape.params,
    body: cancelOrderSchema.shape.body,
  }),
  ...staffPipeline,
  asyncHandler(orderController.cancelOrder),
);

// PATCH /orders/:orderId/items/:itemId/cancel — Staff+
ordersRouter.patch(
  '/:orderId/items/:itemId/cancel',
  validate({
    params: cancelOrderItemSchema.shape.params,
    body: cancelOrderItemSchema.shape.body,
  }),
  ...staffPipeline,
  asyncHandler(orderController.cancelItem),
);

export default ordersRouter;
