import type { Request, Response } from 'express';
import { paymentService } from './payments.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { RefundDto } from './payments.dto';

export const paymentController = {
  async getBySession(req: AuthenticatedStaffRequest, res: Response) {
    const data = await paymentService.getBySession(Number(req.params.sessionId));
    sendSuccess(res, data);
  },

  async getByOrder(req: AuthenticatedStaffRequest, res: Response) {
    const data = await paymentService.getByOrder(Number(req.params.orderId));
    sendSuccess(res, data);
  },

  // Public webhook — no staff auth
  async esewaVerify(req: Request, res: Response) {
    const result = await paymentService.verifyEsewa({
      oid: req.body.oid,
      amt: req.body.amt,
      refId: req.body.refId,
    });
    sendSuccess(res, result);
  },

  async refund(req: AuthenticatedStaffRequest, res: Response) {
    const data = await paymentService.refund(
      Number(req.params.paymentId),
      req.user!.sub,
      req.user!.branchId!,
      req.user!.restaurantId,
      req.body as RefundDto,
    );
    sendSuccess(res, data);
  },
};
