import type { Response } from 'express';
import { staffService } from './staff.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { InviteStaffDto, UpdateRoleDto } from './staff.dto';

export const staffController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const result = await staffService.list(
      req.user!.restaurantId,
      req.query as Record<string, string | undefined>,
    );
    res.json({ success: true, ...result });
  },

  async invite(req: AuthenticatedStaffRequest, res: Response) {
    const data = await staffService.invite(req.user!.restaurantId, req.body as InviteStaffDto);
    sendCreated(res, data);
  },

  async whitelist(req: AuthenticatedStaffRequest, res: Response) {
    const data = await staffService.whitelist(Number(req.params.staffId), req.user!.restaurantId);
    sendSuccess(res, data);
  },

  async suspend(req: AuthenticatedStaffRequest, res: Response) {
    const data = await staffService.suspend(Number(req.params.staffId), req.user!.restaurantId);
    sendSuccess(res, data);
  },

  async updateRole(req: AuthenticatedStaffRequest, res: Response) {
    const data = await staffService.updateRole(
      Number(req.params.staffId),
      req.user!.restaurantId,
      req.body as UpdateRoleDto,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await staffService.softDelete(Number(req.params.staffId), req.user!.restaurantId);
    sendNoContent(res);
  },

  async getLogs(req: AuthenticatedStaffRequest, res: Response) {
    const result = await staffService.getLogs(
      Number(req.params.staffId),
      req.user!.restaurantId,
      req.query as Record<string, string | undefined>,
    );
    res.json({ success: true, ...result });
  },
};
