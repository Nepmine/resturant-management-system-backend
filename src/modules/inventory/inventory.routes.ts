import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  invBranchParamSchema, invItemParamSchema, invCategoryParamSchema,
  createInvCategorySchema, updateInvCategorySchema,
  createInventoryItemSchema, updateInventoryItemSchema,
  adjustStockSchema, inventoryLogsQuerySchema,
} from './inventory.schema';

const staffPipeline   = [authenticate, resolveTenant, authorize('staff')];
const managerPipeline = [authenticate, resolveTenant, authorize('manager')];

// Mounted under /branches/:branchId/inventory in app.ts (mergeParams: true)
const router = Router({ mergeParams: true });

// ─── Inventory categories ────────────────────────────────────────────────────
router.get('/categories', validate({ params: invBranchParamSchema.shape.params }), ...staffPipeline, asyncHandler(inventoryController.listCategories));
router.post('/categories', validate({ params: invBranchParamSchema.shape.params, body: createInvCategorySchema.shape.body }), ...managerPipeline, asyncHandler(inventoryController.createCategory));
router.patch('/categories/:categoryId', validate({ params: invCategoryParamSchema.shape.params, body: updateInvCategorySchema.shape.body }), ...managerPipeline, asyncHandler(inventoryController.updateCategory));
router.delete('/categories/:categoryId', validate({ params: invCategoryParamSchema.shape.params }), ...managerPipeline, asyncHandler(inventoryController.deleteCategory));

// ─── Inventory items ─────────────────────────────────────────────────────────
// GET /low-stock BEFORE /:itemId to avoid route shadowing
router.get('/low-stock', validate({ params: invBranchParamSchema.shape.params }), ...staffPipeline, asyncHandler(inventoryController.listLowStock));
router.get('/', validate({ params: invBranchParamSchema.shape.params }), ...staffPipeline, asyncHandler(inventoryController.listItems));
router.post('/', validate({ params: invBranchParamSchema.shape.params, body: createInventoryItemSchema.shape.body }), ...managerPipeline, asyncHandler(inventoryController.createItem));
router.patch('/:itemId', validate({ params: invItemParamSchema.shape.params, body: updateInventoryItemSchema.shape.body }), ...managerPipeline, asyncHandler(inventoryController.updateItem));
router.delete('/:itemId', validate({ params: invItemParamSchema.shape.params }), ...managerPipeline, asyncHandler(inventoryController.deleteItem));

// ─── Stock adjustment + logs ─────────────────────────────────────────────────
router.post('/:itemId/adjust', validate({ params: adjustStockSchema.shape.params, body: adjustStockSchema.shape.body }), ...staffPipeline, asyncHandler(inventoryController.adjustStock));
router.get('/:itemId/logs', validate({ params: invItemParamSchema.shape.params, query: inventoryLogsQuerySchema.shape.query }), ...managerPipeline, asyncHandler(inventoryController.getLogs));

export default router;
