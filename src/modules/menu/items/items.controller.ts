import type { Response } from 'express';
import { itemService } from './items.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../../types/express';
import type { CreateItemDto, UpdateItemDto, AvailabilityDto } from './items.dto';

export const itemController = {
  async create(req: AuthenticatedStaffRequest, res: Response) {
    const data = await itemService.create(
      Number(req.params.categoryId),
      req.user!.branchId!,
      req.user!.sub,
      req.body as CreateItemDto,
    );
    sendCreated(res, data);
  },

  async getById(req: AuthenticatedStaffRequest, res: Response) {
    const data = await itemService.getById(
      Number(req.params.itemId),
      req.user!.branchId!,
    );
    sendSuccess(res, data);
  },

  async update(req: AuthenticatedStaffRequest, res: Response) {
    const data = await itemService.update(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.sub,
      req.body as UpdateItemDto,
    );
    sendSuccess(res, data);
  },

  async setAvailability(req: AuthenticatedStaffRequest, res: Response) {
    const data = await itemService.setAvailability(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.sub,
      req.body as AvailabilityDto,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await itemService.softDelete(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.user!.sub,
    );
    sendNoContent(res);
  },
};
