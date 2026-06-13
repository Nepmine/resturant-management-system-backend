import type { Response } from 'express';
import { billService } from './bills.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { CreateBillDto, UpdateBillDto } from './bills.dto';

export const billController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const result = await billService.list(
      Number(req.params.branchId), req.user!.restaurantId,
      req.query as Record<string, string | undefined>,
    );
    res.json({ success: true, ...result });
  },

  async create(req: AuthenticatedStaffRequest, res: Response) {
    const data = await billService.create(Number(req.params.branchId), req.user!.restaurantId, req.body as CreateBillDto);
    sendCreated(res, data);
  },

  async update(req: AuthenticatedStaffRequest, res: Response) {
    const data = await billService.update(Number(req.params.billId), Number(req.params.branchId), req.user!.restaurantId, req.body as UpdateBillDto);
    sendSuccess(res, data);
  },

  async markPaid(req: AuthenticatedStaffRequest, res: Response) {
    const data = await billService.markPaid(Number(req.params.billId), Number(req.params.branchId), req.user!.restaurantId);
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await billService.softDelete(Number(req.params.billId), Number(req.params.branchId), req.user!.restaurantId);
    sendNoContent(res);
  },
};
