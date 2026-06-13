import { Router } from 'express';
import { customerWaiterRequestController } from './waiter-requests.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { memberAuth } from '../../middleware/memberAuth';
import { updatedAfterQuery } from '../../middleware/validate';
import { submitWaiterRequestSchema } from '../../modules/waiter-requests/waiter-requests.schema';

const router = Router();

router.post(
  '/',
  memberAuth,
  validate({ body: submitWaiterRequestSchema.shape.body }),
  asyncHandler(customerWaiterRequestController.submit),
);

router.get(
  '/',
  memberAuth,
  validate({ query: updatedAfterQuery }),
  asyncHandler(customerWaiterRequestController.list),
);

export default router;
