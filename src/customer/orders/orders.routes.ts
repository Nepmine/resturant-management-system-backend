import { Router } from 'express';
import { customerOrderController } from './orders.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { memberAuth } from '../../middleware/memberAuth';
import {
  customerOrderParamSchema,
  customerOrderQuerySchema,
  placeOrderSchema,
  addItemsSchema,
  cancelCustomerOrderSchema,
} from './orders.schema';

// Mounted under /customer/orders in app.ts
const router = Router();

// POST /customer/orders — Member JWT (place new order)
router.post(
  '/',
  memberAuth,
  validate({ body: placeOrderSchema.shape.body }),
  asyncHandler(customerOrderController.placeOrder),
);

// GET /customer/orders — Member JWT (all orders in session, supports ?updatedAfter=)
router.get(
  '/',
  memberAuth,
  validate({ query: customerOrderQuerySchema.shape.query }),
  asyncHandler(customerOrderController.listOrders),
);

// GET /customer/orders/:orderId — Member JWT
router.get(
  '/:orderId',
  memberAuth,
  validate({ params: customerOrderParamSchema.shape.params }),
  asyncHandler(customerOrderController.getById),
);

// POST /customer/orders/:orderId/items — Member JWT (add items to pending order)
router.post(
  '/:orderId/items',
  memberAuth,
  validate({
    params: addItemsSchema.shape.params,
    body: addItemsSchema.shape.body,
  }),
  asyncHandler(customerOrderController.addItems),
);

// POST /customer/orders/:orderId/cancel — Member JWT
router.post(
  '/:orderId/cancel',
  memberAuth,
  validate({ params: cancelCustomerOrderSchema.shape.params }),
  asyncHandler(customerOrderController.cancelOrder),
);

export default router;
