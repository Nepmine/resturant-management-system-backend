import type { Response } from 'express';
import { sessionService } from './sessions.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';

export const sessionController = {
  async listActive(req: AuthenticatedStaffRequest, res: Response) {
    const data = await sessionService.listActive(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async getById(req: AuthenticatedStaffRequest, res: Response) {
    const data = await sessionService.getById(
      Number(req.params.sessionId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async close(req: AuthenticatedStaffRequest, res: Response) {
    const data = await sessionService.close(
      Number(req.params.sessionId),
      req.user!.branchId!,
      req.user!.restaurantId,
      req.user!.sub,
    );
    sendSuccess(res, data);
  },
};
