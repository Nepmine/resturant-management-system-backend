import { Router } from 'express';
import { customerPaymentController } from './payments.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { memberAuth } from '../../middleware/memberAuth';
import { initiatePaymentSchema, esewaInitiateSchema } from './payments.schema';

// Mounted under /customer/payments in app.ts
const router = Router();

// POST /customer/payments — Member JWT (initiate cash or eSewa)
router.post(
  '/',
  memberAuth,
  validate({ body: initiatePaymentSchema.shape.body }),
  asyncHandler(customerPaymentController.initiatePayment),
);

// POST /customer/payments/esewa/initiate — Member JWT
// Must be before /:id to avoid shadowing
router.post(
  '/esewa/initiate',
  memberAuth,
  validate({ body: esewaInitiateSchema.shape.body }),
  asyncHandler(customerPaymentController.initiateEsewa),
);

// GET /customer/payments — Member JWT (poll payment status)
router.get(
  '/',
  memberAuth,
  asyncHandler(customerPaymentController.listPayments),
);

export default router;
