import type { Response } from 'express';
import { sectionService } from './sections.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { CreateSectionDto, UpdateSectionDto } from './sections.dto';

export const sectionController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const data = await sectionService.list(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async create(req: AuthenticatedStaffRequest, res: Response) {
    const data = await sectionService.create(
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as CreateSectionDto,
    );
    sendCreated(res, data);
  },

  async update(req: AuthenticatedStaffRequest, res: Response) {
    const data = await sectionService.update(
      Number(req.params.sectionId),
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as UpdateSectionDto,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await sectionService.softDelete(
      Number(req.params.sectionId),
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendNoContent(res);
  },
};
