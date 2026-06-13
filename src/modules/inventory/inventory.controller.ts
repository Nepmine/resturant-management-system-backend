import type { Response } from 'express';
import { inventoryService } from './inventory.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type {
  CreateInvCategoryDto, UpdateInvCategoryDto,
  CreateInventoryItemDto, UpdateInventoryItemDto, AdjustStockDto,
} from './inventory.dto';

export const inventoryController = {
  // ─── Categories ──────────────────────────────────────────────────────────
  async listCategories(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.listCategories(Number(req.params.branchId), req.user!.restaurantId);
    sendSuccess(res, data);
  },
  async createCategory(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.createCategory(Number(req.params.branchId), req.user!.restaurantId, req.body as CreateInvCategoryDto);
    sendCreated(res, data);
  },
  async updateCategory(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.updateCategory(Number(req.params.categoryId), Number(req.params.branchId), req.user!.restaurantId, req.body as UpdateInvCategoryDto);
    sendSuccess(res, data);
  },
  async deleteCategory(req: AuthenticatedStaffRequest, res: Response) {
    await inventoryService.deleteCategory(Number(req.params.categoryId), Number(req.params.branchId), req.user!.restaurantId);
    sendNoContent(res);
  },

  // ─── Items ───────────────────────────────────────────────────────────────
  async listItems(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.listItems(Number(req.params.branchId), req.user!.restaurantId, false);
    sendSuccess(res, data);
  },
  async listLowStock(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.listItems(Number(req.params.branchId), req.user!.restaurantId, true);
    sendSuccess(res, data);
  },
  async createItem(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.createItem(Number(req.params.branchId), req.user!.restaurantId, req.body as CreateInventoryItemDto);
    sendCreated(res, data);
  },
  async updateItem(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.updateItem(Number(req.params.itemId), Number(req.params.branchId), req.user!.restaurantId, req.body as UpdateInventoryItemDto);
    sendSuccess(res, data);
  },
  async adjustStock(req: AuthenticatedStaffRequest, res: Response) {
    const data = await inventoryService.adjustStock(Number(req.params.itemId), Number(req.params.branchId), req.user!.restaurantId, req.user!.sub, req.body as AdjustStockDto);
    sendSuccess(res, data);
  },
  async deleteItem(req: AuthenticatedStaffRequest, res: Response) {
    await inventoryService.deleteItem(Number(req.params.itemId), Number(req.params.branchId), req.user!.restaurantId);
    sendNoContent(res);
  },
  async getLogs(req: AuthenticatedStaffRequest, res: Response) {
    const result = await inventoryService.getLogs(Number(req.params.itemId), Number(req.params.branchId), req.user!.restaurantId, req.query as Record<string, string | undefined>);
    res.json({ success: true, ...result });
  },
};
