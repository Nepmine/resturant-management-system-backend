import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { auditLog } from '../../utils/auditLog';
import { paymentRepository } from './payments.repository';
import { verifyEsewaPayment } from './payments.esewa';
import type { RefundDto, PaymentDto } from './payments.dto';

// ─── formatter ─────────────────────────────────────────────────────────────

function formatPayment(p: {
  id: number;
  sessionId: number;
  orderId: number | null;
  memberId: number | null;
  amount: number | { toNumber(): number };
  method: string;
  status: string;
  esewaRefId: string | null;
  esewaPid: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): PaymentDto {
  return {
    id: p.id,
    sessionId: p.sessionId,
    orderId: p.orderId,
    memberId: p.memberId,
    amount: typeof p.amount === 'object' ? p.amount.toNumber() : Number(p.amount),
    method: p.method,
    status: p.status,
    esewaRefId: p.esewaRefId,
    esewaPid: p.esewaPid,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

export const paymentService = {
  // ── Staff read endpoints ────────────────────────────────────────────────

  async getBySession(sessionId: number): Promise<PaymentDto[]> {
    const payments = await paymentRepository.findBySession(sessionId);
    return payments.map(formatPayment);
  },

  async getByOrder(orderId: number): Promise<PaymentDto[]> {
    const payments = await paymentRepository.findByOrder(orderId);
    return payments.map(formatPayment);
  },

  // ── eSewa webhook ───────────────────────────────────────────────────────

  /**
   * POST /payments/esewa/verify — Public (webhook)
   * §D10 / §F2: Called by eSewa on payment completion.
   *
   * Flow:
   *  1. Find payment row by esewaPid (= oid in callback)
   *  2. Verify with eSewa API
   *  3. On success: mark completed (only mutation on an existing payment row)
   *  4. On failure: mark failed
   *
   * §B2.16: Payments are append-only — this is the ONLY place an existing row is updated,
   * and only to transition pending→completed or pending→failed.
   */
  async verifyEsewa(params: {
    oid: string;
    amt: string;
    refId: string;
  }): Promise<{ verified: boolean; paymentId: number }> {
    const payment = await paymentRepository.findByEsewaPid(params.oid);
    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status === 'completed') {
      // Idempotent: already verified (eSewa may retry)
      return { verified: true, paymentId: payment.id };
    }

    if (payment.status !== 'pending') {
      throw new AppError('Payment is not in pending state', 409, 'PAYMENT_NOT_PENDING');
    }

    // Verify amount matches (prevent amount-tampering attacks)
    const expectedAmount = Number(payment.amount);
    const receivedAmount = parseFloat(params.amt);
    if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
      await paymentRepository.markFailed(payment.id);
      throw new AppError('Payment amount mismatch', 400, 'AMOUNT_MISMATCH');
    }

    const verified = await verifyEsewaPayment(params);

    if (verified) {
      await paymentRepository.markCompleted(payment.id, params.refId);
      return { verified: true, paymentId: payment.id };
    } else {
      await paymentRepository.markFailed(payment.id);
      return { verified: false, paymentId: payment.id };
    }
  },

  // ── Refund ──────────────────────────────────────────────────────────────

  /**
   * POST /payments/:paymentId/refund — Manager+
   * §B2.16: Refund = new negative-amount row. The original row is NEVER updated.
   *
   * Guards:
   *  - Original payment must be completed
   *  - Refund amount must not exceed original (cumulative check)
   */
  async refund(
    paymentId: number,
    staffId: number,
    branchId: number,
    restaurantId: number,
    dto: RefundDto,
  ): Promise<PaymentDto> {
    return prisma.$transaction(async (tx) => {
      const original = await paymentRepository.findById(paymentId, tx);
      if (!original) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      if (original.status !== 'completed') {
        throw new AppError(
          'Only completed payments can be refunded',
          409,
          'PAYMENT_NOT_COMPLETED',
        );
      }

      // Cumulative refund guard: total refunds must not exceed original amount
      const existingRefunds = await tx.payment.aggregate({
        where: {
          sessionId: original.sessionId,
          orderId: original.orderId,
          amount: { lt: 0 },    // refunds are negative amounts
          status: 'completed',
        },
        _sum: { amount: true },
      });
      const totalRefunded = Math.abs(Number(existingRefunds._sum.amount ?? 0));
      const originalAmount = Number(original.amount);

      if (totalRefunded + dto.amount > originalAmount) {
        throw new AppError(
          `Refund of ${dto.amount} would exceed original payment of ${originalAmount} (already refunded: ${totalRefunded})`,
          400,
          'REFUND_EXCEEDS_ORIGINAL',
        );
      }

      // Append a new negative-amount row — never update the original
      const refundRow = await paymentRepository.create(
        {
          sessionId: original.sessionId,
          orderId: original.orderId,
          memberId: original.memberId,
          amount: -dto.amount,     // negative = refund
          method: original.method,
          status: 'refunded',
          paidAt: new Date(),
        },
        tx,
      );

      await auditLog(tx, {
        staffId,
        branchId,
        actionType: 'payment.refunded',
        targetType: 'payment',
        targetId: original.id,
        meta: {
          refundPaymentId: refundRow.id,
          amount: dto.amount,
          reason: dto.reason,
          originalAmount,
        },
      });

      return formatPayment(refundRow);
    });
  },
};
