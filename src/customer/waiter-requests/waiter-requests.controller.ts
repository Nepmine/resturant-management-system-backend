import type { Response } from 'express';
import { customerWaiterRequestService } from './waiter-requests.service';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';
import type { AuthenticatedMemberRequest } from '../../types/express';

export const customerWaiterRequestController = {
  async submit(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerWaiterRequestService.submit(req.member!, req.body.type);
    sendCreated(res, data);
  },

  async list(req: AuthenticatedMemberRequest, res: Response) {
    const updatedAfter = req.query.updatedAfter ? new Date(req.query.updatedAfter as string) : undefined;
    const data = await customerWaiterRequestService.listForSession(req.member!, updatedAfter);
    sendSuccess(res, data);
  },
};
