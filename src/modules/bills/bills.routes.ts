import { Router } from 'express';
import { billController } from './bills.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  billBranchParamSchema, billParamSchema,
  billListQuerySchema, createBillSchema, updateBillSchema,
} from './bills.schema';

const managerPipeline = [authenticate, resolveTenant, authorize('manager')];
const adminPipeline   = [authenticate, resolveTenant, authorize('admin')];

// Mounted under /branches/:branchId/bills in app.ts (mergeParams: true)
const router = Router({ mergeParams: true });

router.get('/', validate({ params: billBranchParamSchema.shape.params, query: billListQuerySchema.shape.query }), ...managerPipeline, asyncHandler(billController.list));
router.post('/', validate({ params: billBranchParamSchema.shape.params, body: createBillSchema.shape.body }), ...managerPipeline, asyncHandler(billController.create));
router.patch('/:billId', validate({ params: billParamSchema.shape.params, body: updateBillSchema.shape.body }), ...managerPipeline, asyncHandler(billController.update));
router.patch('/:billId/pay', validate({ params: billParamSchema.shape.params }), ...managerPipeline, asyncHandler(billController.markPaid));
router.delete('/:billId', validate({ params: billParamSchema.shape.params }), ...adminPipeline, asyncHandler(billController.softDelete));

export default router;
