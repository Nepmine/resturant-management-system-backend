import { Router } from 'express';
import { invoiceController } from './invoices.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  sessionInvoiceParamSchema,
  orderInvoiceParamSchema,
} from './invoices.schema';

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];

// ─── Session invoice routes: mounted under /sessions/:sessionId ────────────
export const sessionInvoiceRouter = Router({ mergeParams: true });

// GET /sessions/:sessionId/invoice — Staff+
sessionInvoiceRouter.get(
  '/',
  validate({ params: sessionInvoiceParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(invoiceController.getSessionInvoice),
);

// GET /sessions/:sessionId/invoice/pdf — Staff+
sessionInvoiceRouter.get(
  '/pdf',
  validate({ params: sessionInvoiceParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(invoiceController.getSessionInvoicePdf),
);

// ─── Order invoice routes: mounted under /orders/:orderId ─────────────────
export const orderInvoiceRouter = Router({ mergeParams: true });

// GET /orders/:orderId/invoice — Staff+
orderInvoiceRouter.get(
  '/',
  validate({ params: orderInvoiceParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(invoiceController.getOrderInvoice),
);

// GET /orders/:orderId/invoice/pdf — Staff+
orderInvoiceRouter.get(
  '/pdf',
  validate({ params: orderInvoiceParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(invoiceController.getOrderInvoicePdf),
);
