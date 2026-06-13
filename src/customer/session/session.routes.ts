import { Router } from 'express';
import { customerSessionController } from './session.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { memberAuth } from '../../middleware/memberAuth';

// Mounted under /customer/session in app.ts
const router = Router();

// GET /customer/session — Member JWT
router.get(
  '/',
  memberAuth,
  asyncHandler(customerSessionController.getCurrent),
);

// POST /customer/session/leave — Member JWT
router.post(
  '/leave',
  memberAuth,
  asyncHandler(customerSessionController.leave),
);

// POST /customer/session/complete — Member JWT
router.post(
  '/complete',
  memberAuth,
  asyncHandler(customerSessionController.complete),
);

export default router;
