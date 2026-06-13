import type { Request, Response } from 'express';
import { subscriptionService } from './subscriptions.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { UpgradeSubscriptionDto, CancelSubscriptionDto } from './subscriptions.dto';

export const subscriptionController = {
  async getActive(req: Request, res: Response) {
    const data = await subscriptionService.getActive(Number(req.params.id));
    sendSuccess(res, data);
  },

  async upgrade(req: Request, res: Response) {
    const data = await subscriptionService.upgrade(
      Number(req.params.id),
      req.body as UpgradeSubscriptionDto,
    );
    sendSuccess(res, data);
  },

  async cancel(req: Request, res: Response) {
    const data = await subscriptionService.cancel(
      Number(req.params.id),
      req.body as CancelSubscriptionDto,
    );
    sendSuccess(res, data);
  },

  async getBillingHistory(req: Request, res: Response) {
    const data = await subscriptionService.getBillingHistory(Number(req.params.id));
    sendSuccess(res, data);
  },
};
