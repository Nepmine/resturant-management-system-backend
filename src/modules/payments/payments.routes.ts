import { Router } from 'express';
import { paymentController } from './payments.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import { esewaWebhookLimiter } from '../../middleware/rateLimiter';
import {
  sessionPaymentsParamSchema,
  orderPaymentsParamSchema,
  paymentParamSchema,
  refundSchema,
  esewaVerifySchema,
} from './payments.schema';

const staffPipeline   = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];

// ─── Session-nested: /sessions/:sessionId/payments ────────────────────────
export const sessionPaymentsRouter = Router({ mergeParams: true });

sessionPaymentsRouter.get(
  '/',
  validate({ params: sessionPaymentsParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(paymentController.getBySession),
);

// ─── Order-nested: /orders/:orderId/payments ──────────────────────────────
export const orderPaymentsRouter = Router({ mergeParams: true });

orderPaymentsRouter.get(
  '/',
  validate({ params: orderPaymentsParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(paymentController.getByOrder),
);

// ─── Root-level: /payments/* ──────────────────────────────────────────────
const paymentsRouter = Router();

// POST /payments/esewa/verify — Public webhook (rate-limited)
paymentsRouter.post(
  '/esewa/verify',
  esewaWebhookLimiter,
  validate({ body: esewaVerifySchema.shape.body }),
  asyncHandler(paymentController.esewaVerify),
);

// POST /payments/:paymentId/refund — Manager+
paymentsRouter.post(
  '/:paymentId/refund',
  validate({
    params: refundSchema.shape.params,
    body: refundSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(paymentController.refund),
);

export default paymentsRouter;
