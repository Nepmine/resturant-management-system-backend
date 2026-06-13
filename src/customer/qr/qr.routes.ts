import { Router } from 'express';
import { qrController } from './qr.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { qrScanLimiter } from '../../middleware/rateLimiter';
import { qrScanSchema } from './qr.schema';

const router = Router();

// POST /customer/qr/scan — Public (rate-limited)
// §E1: Single entry point for all customer interactions
router.post(
  '/scan',
  qrScanLimiter,
  validate({ body: qrScanSchema.shape.body }),
  asyncHandler(qrController.scan),
);

export default router;
