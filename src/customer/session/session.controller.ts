import type { Response } from 'express';
import { customerSessionService } from './session.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedMemberRequest } from '../../types/express';

export const customerSessionController = {
  async getCurrent(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerSessionService.getCurrent(req.member!);
    sendSuccess(res, data);
  },

  async leave(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerSessionService.leave(req.member!);
    sendSuccess(res, data);
  },

  async complete(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerSessionService.complete(req.member!);
    sendSuccess(res, data);
  },
};
