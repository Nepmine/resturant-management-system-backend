import type { Response } from 'express';
import { kitchenService } from './kitchen.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';

export const kitchenController = {
  async getOrders(req: AuthenticatedStaffRequest, res: Response) {
    const updatedAfter = req.query.updatedAfter
      ? new Date(req.query.updatedAfter as string)
      : undefined;
    const data = await kitchenService.getOrders(
      Number(req.params.branchId),
      req.user!.restaurantId,
      updatedAfter,
    );
    sendSuccess(res, data);
  },

  async getQueue(req: AuthenticatedStaffRequest, res: Response) {
    const updatedAfter = req.query.updatedAfter
      ? new Date(req.query.updatedAfter as string)
      : undefined;
    const data = await kitchenService.getQueue(
      Number(req.params.branchId),
      req.user!.restaurantId,
      updatedAfter,
    );
    sendSuccess(res, data);
  },

  async markPreparing(req: AuthenticatedStaffRequest, res: Response) {
    const data = await kitchenService.markPreparing(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async markReady(req: AuthenticatedStaffRequest, res: Response) {
    const data = await kitchenService.markReady(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async markDelivered(req: AuthenticatedStaffRequest, res: Response) {
    const data = await kitchenService.markDelivered(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },
};
