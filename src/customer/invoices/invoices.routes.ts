import { Router } from 'express';
import { customerInvoiceController } from './invoices.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { memberAuth } from '../../middleware/memberAuth';
import { customerOrderInvoiceParamSchema } from './invoices.schema';

// Mounted under /customer in app.ts — two separate mount points:
//   /customer/invoice      (session invoice)
//   /customer/orders/:id/invoice  (order invoice, handled by customer orders router or here)

const router = Router();

// GET /customer/invoice — Member JWT (full session invoice)
router.get(
  '/invoice',
  memberAuth,
  asyncHandler(customerInvoiceController.getSessionInvoice),
);

// GET /customer/invoice/pdf — Member JWT
router.get(
  '/invoice/pdf',
  memberAuth,
  asyncHandler(customerInvoiceController.getSessionInvoicePdf),
);

// GET /customer/orders/:orderId/invoice — Member JWT
router.get(
  '/orders/:orderId/invoice',
  memberAuth,
  validate({ params: customerOrderInvoiceParamSchema.shape.params }),
  asyncHandler(customerInvoiceController.getOrderInvoice),
);

// GET /customer/orders/:orderId/invoice/pdf — Member JWT
router.get(
  '/orders/:orderId/invoice/pdf',
  memberAuth,
  validate({ params: customerOrderInvoiceParamSchema.shape.params }),
  asyncHandler(customerInvoiceController.getOrderInvoicePdf),
);

export default router;
