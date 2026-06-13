import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { buildSessionInvoice, buildOrderInvoice } from '../../modules/invoices/invoices.builder';
import type { InvoiceDto } from '../../modules/invoices/invoices.dto';
import type { MemberTokenPayload } from '../../types/express';

export const customerInvoiceService = {
  /**
   * GET /customer/invoice — Member JWT
   * Full session invoice for pre-payment review.
   * §E6: branchId always from req.member.branchId.
   */
  async getSessionInvoice(member: MemberTokenPayload): Promise<InvoiceDto> {
    return buildSessionInvoice(member.sessionId, member.branchId);
  },

  /**
   * GET /customer/orders/:orderId/invoice — Member JWT
   * Single order invoice.
   * §C3 / §E6: assertMemberSessionAccess ensures the order belongs to the member's session.
   */
  async getOrderInvoice(
    orderId: number,
    member: MemberTokenPayload,
  ): Promise<InvoiceDto> {
    // Verify order belongs to this session (not just any order by ID)
    const order = await prisma.order.findFirst({
      where: { id: orderId, sessionId: member.sessionId, deletedAt: null },
      select: { id: true },
    });
    if (!order) {
      throw new AppError('Order not found in your session', 404, 'NOT_FOUND');
    }
    return buildOrderInvoice(orderId, member.branchId);
  },
};
