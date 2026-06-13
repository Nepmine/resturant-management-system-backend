import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../../config/database';

type TxClient = Prisma.TransactionClient;

export const paymentRepository = {
  async findBySession(sessionId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.payment.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findByOrder(orderId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(paymentId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.payment.findUnique({ where: { id: paymentId } });
  },

  async findByEsewaPid(esewaPid: string, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.payment.findFirst({ where: { esewaPid } });
  },

  /** Sum of completed payments for a session (used for overpayment guard). */
  async sumCompleted(sessionId: number, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    const result = await db.payment.aggregate({
      where: { sessionId, status: 'completed' },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  },

  /**
   * Compute the invoice total for a session:
   * sum(unit_price * quantity) for all non-cancelled order_items in non-deleted orders.
   */
  async computeInvoiceTotal(sessionId: number, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    const result = await (db as any).$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)::NUMERIC AS total
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.session_id = ${sessionId}
        AND o.deleted_at IS NULL
        AND oi.deleted_at IS NULL
        AND oi.status != 'cancelled'
    `;
    return Number(result[0]?.total ?? 0);
  },

  async create(
    data: {
      sessionId: number;
      orderId?: number | null;
      memberId?: number | null;
      amount: number;
      method: PaymentMethod;
      status: PaymentStatus;
      esewaRefId?: string | null;
      esewaPid?: string | null;
      paidAt?: Date | null;
    },
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.payment.create({ data });
  },

  /** The ONLY mutation on existing payment rows: eSewa status update. */
  async markCompleted(
    paymentId: number,
    esewaRefId: string,
    tx?: TxClient,
  ) {
    const db = tx ?? prisma;
    return db.payment.update({
      where: { id: paymentId },
      data: { status: 'completed', esewaRefId, paidAt: new Date() },
    });
  },

  async markFailed(paymentId: number, tx?: TxClient) {
    const db = tx ?? prisma;
    return db.payment.update({
      where: { id: paymentId },
      data: { status: 'failed' },
    });
  },
};
