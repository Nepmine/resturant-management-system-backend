import type { Response } from 'express';
import { customerInvoiceService } from './invoices.service';
import { sendSuccess } from '../../utils/apiResponse';
import { streamInvoicePdf } from '../../modules/invoices/invoices.pdf';
import type { AuthenticatedMemberRequest } from '../../types/express';

export const customerInvoiceController = {
  async getSessionInvoice(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerInvoiceService.getSessionInvoice(req.member!);
    sendSuccess(res, data);
  },

  async getSessionInvoicePdf(req: AuthenticatedMemberRequest, res: Response) {
    const invoice = await customerInvoiceService.getSessionInvoice(req.member!);
    streamInvoicePdf(res, invoice);
  },

  async getOrderInvoice(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerInvoiceService.getOrderInvoice(
      Number(req.params.orderId),
      req.member!,
    );
    sendSuccess(res, data);
  },

  async getOrderInvoicePdf(req: AuthenticatedMemberRequest, res: Response) {
    const invoice = await customerInvoiceService.getOrderInvoice(
      Number(req.params.orderId),
      req.member!,
    );
    streamInvoicePdf(res, invoice);
  },
};
