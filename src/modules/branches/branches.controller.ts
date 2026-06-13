import type { Response } from 'express';
import { branchService } from './branches.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { CreateBranchDto, UpdateBranchDto } from './branches.dto';

export const branchController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const data = await branchService.list(req);
    sendSuccess(res, data);
  },

  async getById(req: AuthenticatedStaffRequest, res: Response) {
    const data = await branchService.getById(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async create(req: AuthenticatedStaffRequest, res: Response) {
    const data = await branchService.create(
      req.user!.restaurantId,
      req.body as CreateBranchDto,
    );
    sendCreated(res, data);
  },

  async update(req: AuthenticatedStaffRequest, res: Response) {
    const data = await branchService.update(
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as UpdateBranchDto,
    );
    sendSuccess(res, data);
  },

  async toggle(req: AuthenticatedStaffRequest, res: Response) {
    const data = await branchService.toggle(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await branchService.softDelete(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendNoContent(res);
  },
};
