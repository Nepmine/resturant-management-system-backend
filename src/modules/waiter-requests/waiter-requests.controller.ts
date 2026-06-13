import type { Response } from 'express';
import { waiterRequestService } from './waiter-requests.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';

export const waiterRequestController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const data = await waiterRequestService.list(
      Number(req.params.branchId),
      req.user!.restaurantId,
      {
        status: req.query.status as string | undefined,
        updatedAfter: req.query.updatedAfter ? new Date(req.query.updatedAfter as string) : undefined,
      },
    );
    sendSuccess(res, data);
  },

  async acknowledge(req: AuthenticatedStaffRequest, res: Response) {
    const data = await waiterRequestService.acknowledge(
      Number(req.params.requestId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async resolve(req: AuthenticatedStaffRequest, res: Response) {
    const data = await waiterRequestService.resolve(
      Number(req.params.requestId),
      req.user!.branchId!,
      req.user!.restaurantId,
      req.user!.sub,
    );
    sendSuccess(res, data);
  },
};
