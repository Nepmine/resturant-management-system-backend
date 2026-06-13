import type { Response } from 'express';
import { customerOrderService } from './orders.service';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';
import type { AuthenticatedMemberRequest } from '../../types/express';
import type { PlaceOrderDto, AddItemsDto } from './orders.dto';

export const customerOrderController = {
  async placeOrder(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerOrderService.placeOrder(
      req.member!,
      req.body as PlaceOrderDto,
    );
    sendCreated(res, data);
  },

  async listOrders(req: AuthenticatedMemberRequest, res: Response) {
    const updatedAfter = req.query.updatedAfter
      ? new Date(req.query.updatedAfter as string)
      : undefined;
    const data = await customerOrderService.listSessionOrders(req.member!, updatedAfter);
    sendSuccess(res, data);
  },

  async getById(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerOrderService.getById(
      Number(req.params.orderId),
      req.member!,
    );
    sendSuccess(res, data);
  },

  async addItems(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerOrderService.addItems(
      Number(req.params.orderId),
      req.member!,
      req.body as AddItemsDto,
    );
    sendSuccess(res, data);
  },

  async cancelOrder(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerOrderService.cancelOrder(
      Number(req.params.orderId),
      req.member!,
    );
    sendSuccess(res, data);
  },
};
