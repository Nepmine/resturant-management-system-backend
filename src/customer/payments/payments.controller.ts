import type { Response } from 'express';
import { customerPaymentService } from './payments.service';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';
import type { AuthenticatedMemberRequest } from '../../types/express';
import type { InitiatePaymentDto, EsewaInitiateDto } from './payments.dto';

export const customerPaymentController = {
  async initiatePayment(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerPaymentService.initiatePayment(
      req.member!,
      req.body as InitiatePaymentDto,
    );
    sendCreated(res, data);
  },

  async initiateEsewa(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerPaymentService.initiateEsewa(
      req.member!,
      req.body as EsewaInitiateDto,
    );
    sendCreated(res, data);
  },

  async listPayments(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerPaymentService.listSessionPayments(req.member!);
    sendSuccess(res, data);
  },
};
