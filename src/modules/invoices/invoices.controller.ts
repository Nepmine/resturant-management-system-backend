import type { Response } from 'express';
import { invoiceService } from './invoices.service';
import { sendSuccess } from '../../utils/apiResponse';
import { streamInvoicePdf } from './invoices.pdf';
import type { AuthenticatedStaffRequest } from '../../types/express';

export const invoiceController = {
  // ── Session invoices ───────────────────────────────────────────────────

  async getSessionInvoice(req: AuthenticatedStaffRequest, res: Response) {
    const data = await invoiceService.getSessionInvoice(
      Number(req.params.sessionId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async getSessionInvoicePdf(req: AuthenticatedStaffRequest, res: Response) {
    const invoice = await invoiceService.getSessionInvoice(
      Number(req.params.sessionId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    streamInvoicePdf(res, invoice);
  },

  // ── Order invoices ─────────────────────────────────────────────────────

  async getOrderInvoice(req: AuthenticatedStaffRequest, res: Response) {
    const data = await invoiceService.getOrderInvoice(
      Number(req.params.orderId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async getOrderInvoicePdf(req: AuthenticatedStaffRequest, res: Response) {
    const invoice = await invoiceService.getOrderInvoice(
      Number(req.params.orderId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    streamInvoicePdf(res, invoice);
  },
};
