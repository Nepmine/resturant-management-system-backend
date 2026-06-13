import type { Response } from 'express';
import { orderService } from './orders.service';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type {
  UpdateOrderStatusDto,
  CancelOrderDto,
  CancelOrderItemDto,
  CreateParcelOrderDto,
} from './orders.dto';

export const orderController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const result = await orderService.list(
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.query as Record<string, string | undefined>,
    );
    res.json({ success: true, ...result });
  },

  async getById(req: AuthenticatedStaffRequest, res: Response) {
    const data = await orderService.getById(
      Number(req.params.orderId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async updateStatus(req: AuthenticatedStaffRequest, res: Response) {
    const data = await orderService.updateStatus(
      Number(req.params.orderId),
      req.user!.branchId!,
      req.user!.restaurantId,
      req.user!.sub,
      req.body as UpdateOrderStatusDto,
    );
    sendSuccess(res, data);
  },

  async cancelOrder(req: AuthenticatedStaffRequest, res: Response) {
    const data = await orderService.cancelOrder(
      Number(req.params.orderId),
      req.user!.branchId!,
      req.user!.restaurantId,
      req.user!.sub,
      req.body as CancelOrderDto,
    );
    sendSuccess(res, data);
  },

  async cancelItem(req: AuthenticatedStaffRequest, res: Response) {
    const data = await orderService.cancelItem(
      Number(req.params.orderId),
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.restaurantId,
      req.user!.sub,
      req.body as CancelOrderItemDto,
    );
    sendSuccess(res, data);
  },

  async createParcel(req: AuthenticatedStaffRequest, res: Response) {
    const data = await orderService.createParcel(
      req.user!.branchId!,
      req.user!.restaurantId,
      req.user!.sub,
      req.body as CreateParcelOrderDto,
    );
    sendCreated(res, data);
  },
};
