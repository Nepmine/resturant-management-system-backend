import prisma from '../../config/database';
import { type Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { paymentRepository } from '../../modules/payments/payments.repository';
import { buildEsewaFormParams, generateEsewaPid } from '../../modules/payments/payments.esewa';
import { env } from '../../config/env';
import type { MemberTokenPayload } from '../../types/express';
import type {
  InitiatePaymentDto,
  EsewaInitiateDto,
  CustomerPaymentDto,
  EsewaFormParamsDto,
} from './payments.dto';

function formatPayment(p: {
  id: number;
  amount: number | { toNumber(): number };
  method: string;
  status: string;
  esewaRefId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): CustomerPaymentDto {
  return {
    id: p.id,
    amount: typeof p.amount === 'object' ? p.amount.toNumber() : Number(p.amount),
    method: p.method,
    status: p.status,
    esewaRefId: p.esewaRefId,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

/**
 * Computes the amount due for a session (or scoped to specific orders).
 * §B2.16 overpayment guard: runs inside caller's transaction.
 */
async function computeAmountDue(
  sessionId: number,
  orderIds: number[] | undefined,
  tx: Prisma.TransactionClient,
): Promise<number> {
  // Invoice total for the scope
  const invoiceResult = await (tx as any).$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)::NUMERIC AS total
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.session_id = ${sessionId}
      AND o.deleted_at IS NULL
      AND oi.deleted_at IS NULL
      AND oi.status != 'cancelled'
      ${orderIds && orderIds.length > 0
        ? (tx as any).$raw`AND o.id = ANY(${orderIds}::int[])`
        : (tx as any).$raw``}
  `;
  const invoiceTotal = Number(invoiceResult[0]?.total ?? 0);

  // Already paid (completed payments only, not refunds)
  const paidResult = await (tx as any).$queryRaw<Array<{ paid: number }>>`
    SELECT COALESCE(SUM(amount), 0)::NUMERIC AS paid
    FROM payments
    WHERE session_id = ${sessionId}
      AND status = 'completed'
      AND amount > 0
  `;
  const alreadyPaid = Number(paidResult[0]?.paid ?? 0);

  return Math.max(0, invoiceTotal - alreadyPaid);
}

export const customerPaymentService = {
  /**
   * POST /customer/payments — Member JWT
   * §E5: Initiates payment for session (or specific orders).
   * §B2.16: Overpayment guard — amount must not exceed remaining balance.
   *
   * Cash: creates a 'pending' row (staff confirms receipt).
   * eSewa: redirects customer to eSewa; use /esewa/initiate for form params.
   */
  async initiatePayment(
    member: MemberTokenPayload,
    dto: InitiatePaymentDto,
  ): Promise<CustomerPaymentDto> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.diningSession.findFirst({
        where: { id: member.sessionId, status: 'active' },
        select: { id: true },
      });
      if (!session) throw new AppError('Session is not active', 400, 'SESSION_NOT_ACTIVE');

      const amountDue = await computeAmountDue(member.sessionId, dto.orderIds, tx);
      if (amountDue <= 0) {
        throw new AppError('No outstanding balance', 400, 'ALREADY_PAID');
      }

      const payment = await paymentRepository.create(
        {
          sessionId: member.sessionId,
          memberId: member.sub,
          amount: amountDue,
          method: dto.method as any,
          status: 'pending',
          paidAt: dto.method === 'cash' ? new Date() : null,
        },
        tx,
      );

      // Cash: mark completed immediately (staff trust model)
      if (dto.method === 'cash') {
        const completed = await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'completed' },
        });
        return formatPayment(completed);
      }

      return formatPayment(payment);
    });
  },

  /**
   * POST /customer/payments/esewa/initiate — Member JWT
   * Returns eSewa form parameters the frontend posts to eSewa's payment page.
   * Creates a pending payment row with an esewaPid for later webhook verification.
   */
  async initiateEsewa(
    member: MemberTokenPayload,
    dto: EsewaInitiateDto,
  ): Promise<EsewaFormParamsDto> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.diningSession.findFirst({
        where: { id: member.sessionId, status: 'active' },
        select: { id: true },
      });
      if (!session) throw new AppError('Session is not active', 400, 'SESSION_NOT_ACTIVE');

      const amountDue = await computeAmountDue(member.sessionId, dto.orderIds, tx);
      if (amountDue <= 0) {
        throw new AppError('No outstanding balance', 400, 'ALREADY_PAID');
      }

      const esewaPid = generateEsewaPid();

      const payment = await paymentRepository.create(
        {
          sessionId: member.sessionId,
          memberId: member.sub,
          amount: amountDue,
          method: 'esewa',
          status: 'pending',
          esewaPid,
        },
        tx,
      );

      const formParams = buildEsewaFormParams({
        amount: amountDue,
        pid: esewaPid,
        successUrl: dto.successUrl,
        failureUrl: dto.failureUrl,
      });

      return {
        paymentId: payment.id,
        esewaPid,
        formParams,
      };
    });
  },

  /**
   * GET /customer/payments — Member JWT
   * All payment rows for the current session (for polling status).
   */
  async listSessionPayments(member: MemberTokenPayload): Promise<CustomerPaymentDto[]> {
    const payments = await paymentRepository.findBySession(member.sessionId);
    return payments.map(formatPayment);
  },
};
