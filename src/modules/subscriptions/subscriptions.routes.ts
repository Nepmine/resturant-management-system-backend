import { Router } from 'express';
import { subscriptionController } from './subscriptions.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  subscriptionRestaurantParamSchema,
  upgradeSubscriptionSchema,
  cancelSubscriptionSchema,
} from './subscriptions.schema';

// Mounted under /restaurants/:id/subscription* in app.ts
const router = Router({ mergeParams: true });

const adminPipeline = [authenticate, resolveTenant, authorize('admin')];

// GET /restaurants/:id/subscription
router.get(
  '/',
  validate({ params: subscriptionRestaurantParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(subscriptionController.getActive),
);

// POST /restaurants/:id/subscription/upgrade
router.post(
  '/upgrade',
  validate({
    params: upgradeSubscriptionSchema.shape.params,
    body: upgradeSubscriptionSchema.shape.body,
  }),
  ...adminPipeline,
  asyncHandler(subscriptionController.upgrade),
);

// POST /restaurants/:id/subscription/cancel
router.post(
  '/cancel',
  validate({
    params: cancelSubscriptionSchema.shape.params,
    body: cancelSubscriptionSchema.shape.body,
  }),
  ...adminPipeline,
  asyncHandler(subscriptionController.cancel),
);

// GET /restaurants/:id/subscriptions  (billing history)
// Note: separate plural route; mounted additionally in app.ts
export const billingHistoryRouter = Router({ mergeParams: true });
billingHistoryRouter.get(
  '/',
  validate({ params: subscriptionRestaurantParamSchema.shape.params }),
  ...adminPipeline,
  asyncHandler(subscriptionController.getBillingHistory),
);

export default router;
