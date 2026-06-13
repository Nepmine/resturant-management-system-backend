import { Router } from 'express';
import { tableController } from './tables.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  tableBranchParamSchema,
  createTableSchema,
  updateTableSchema,
  tableNestedParamSchema,
  tableRootParamSchema,
  tableListQuerySchema,
} from './tables.schema';

const staffPipeline   = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];

// ─── Branch-nested router: /branches/:branchId/tables ─────────────────────
// Mounted with mergeParams: true in app.ts
export const branchTablesRouter = Router({ mergeParams: true });

// GET /branches/:branchId/tables — Staff+
branchTablesRouter.get(
  '/',
  validate({
    params: tableBranchParamSchema.shape.params,
    query: tableListQuerySchema.shape.query,
  }),
  ...staffPipeline,
  asyncHandler(tableController.list),
);

// POST /branches/:branchId/tables — Manager+
branchTablesRouter.post(
  '/',
  validate({
    params: createTableSchema.shape.params,
    body: createTableSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(tableController.create),
);

// PATCH /branches/:branchId/tables/:tableId — Manager+
branchTablesRouter.patch(
  '/:tableId',
  validate({
    params: updateTableSchema.shape.params,
    body: updateTableSchema.shape.body,
  }),
  ...managerPipeline,
  asyncHandler(tableController.update),
);

// DELETE /branches/:branchId/tables/:tableId — Manager+
branchTablesRouter.delete(
  '/:tableId',
  validate({ params: tableNestedParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(tableController.softDelete),
);

// ─── Root-level router: /tables/:tableId/* ─────────────────────────────────
// §D6: QR and status-transition routes live at /tables/:tableId, not nested.
// Mounted at /tables in app.ts.
const tablesRouter = Router();

// GET /tables/:tableId/qr — Manager+
tablesRouter.get(
  '/:tableId/qr',
  validate({ params: tableRootParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(tableController.getQr),
);

// POST /tables/:tableId/regenerate-qr — Manager+
tablesRouter.post(
  '/:tableId/regenerate-qr',
  validate({ params: tableRootParamSchema.shape.params }),
  ...managerPipeline,
  asyncHandler(tableController.regenerateQr),
);

// POST /tables/:tableId/cleaning — Staff+
// Transition: occupied → cleaning (called when session closes)
tablesRouter.post(
  '/:tableId/cleaning',
  validate({ params: tableRootParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(tableController.markCleaning),
);

// POST /tables/:tableId/available — Staff+
// Transition: cleaning → available (staff confirms cleaning done)
tablesRouter.post(
  '/:tableId/available',
  validate({ params: tableRootParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(tableController.markAvailable),
);

export default tablesRouter;
