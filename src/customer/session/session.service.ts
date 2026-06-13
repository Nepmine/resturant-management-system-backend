import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import type { MemberTokenPayload } from '../../types/express';
import type { CustomerSessionDto } from './session.dto';

function formatSession(s: {
  id: number;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  table: {
    id: number;
    tableNumber: number;
    label: string | null;
    section: { name: string };
  };
  members: Array<{ id: number; name: string; joinedAt: Date }>;
}): CustomerSessionDto {
  return {
    id: s.id,
    status: s.status,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    table: {
      id: s.table.id,
      tableNumber: s.table.tableNumber,
      label: s.table.label,
      sectionName: s.table.section.name,
    },
    members: s.members.map((m) => ({
      id: m.id,
      name: m.name,
      joinedAt: m.joinedAt,
    })),
    memberCount: s.members.length,
  };
}

export const customerSessionService = {
  /**
   * GET /customer/session — Member JWT
   * Returns current session state including all members and table info.
   */
  async getCurrent(member: MemberTokenPayload): Promise<CustomerSessionDto> {
    const session = await prisma.diningSession.findFirst({
      where: { id: member.sessionId },
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
            label: true,
            section: { select: { name: true } },
          },
        },
        members: {
          select: { id: true, name: true, joinedAt: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');
    return formatSession(session);
  },

  /**
   * POST /customer/session/leave — Member JWT
   *
   * Removes this member from the session.
   *
   * §E2 Last-member-leaves rule:
   *   remaining members == 0 AND no non-cancelled orders
   *     → session 'abandoned', table 'available'   (clean up immediately)
   *   remaining members == 0 AND non-cancelled orders exist
   *     → session stays 'active', table stays 'occupied'
   *     → notification created for staff
   */
  async leave(member: MemberTokenPayload): Promise<{ message: string }> {
    return prisma.$transaction(async (tx) => {
      // Verify session is still active
      const sessions = await tx.$queryRaw<
        Array<{ id: number; status: string; table_id: number; branch_id: number; restaurant_id: number }>
      >`
        SELECT ds.id, ds.status, ds.table_id, ds.branch_id, b.restaurant_id
        FROM dining_sessions ds
        JOIN branches b ON b.id = ds.branch_id
        WHERE ds.id = ${member.sessionId}
        LIMIT 1
        FOR UPDATE
      `;

      const session = sessions[0];
      if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');
      if (session.status !== 'active') {
        throw new AppError('Session is no longer active', 409, 'SESSION_NOT_ACTIVE');
      }

      // Remove this member
      await tx.sessionMember.delete({ where: { id: member.sub } });

      // Count remaining members
      const remaining = await tx.sessionMember.count({
        where: { sessionId: member.sessionId },
      });

      if (remaining === 0) {
        // Check for non-cancelled orders
        const orderCount = await tx.order.count({
          where: {
            sessionId: member.sessionId,
            status: { not: 'cancelled' },
            deletedAt: null,
          },
        });

        if (orderCount === 0) {
          // No orders — abandon + free the table immediately
          await tx.diningSession.update({
            where: { id: member.sessionId },
            data: { status: 'abandoned', completedAt: new Date() },
          });
          await tx.table.update({
            where: { id: session.table_id },
            data: { status: 'available' },
          });
        } else {
          // Orders exist — leave session active for staff to handle
          await tx.notification.create({
            data: {
              restaurantId: session.restaurant_id,
              branchId: session.branch_id,
              type: 'waiter_called',
              title: 'All customers left',
              message: `All members left session #${member.sessionId} but ${orderCount} active order(s) remain. Manual close required.`,
              referenceType: 'dining_session',
              referenceId: member.sessionId,
            },
          });
        }
      }

      return { message: 'You have left the session.' };
    });
  },

  /**
   * POST /customer/session/complete — Member JWT
   *
   * §F1 / §E2: Customer-initiated session completion.
   * Guards:
   *  - All orders must be in terminal state (delivered or cancelled)
   *  - No pending payments (sum of completed payments must cover invoice)
   *
   * Uses FOR UPDATE to prevent concurrent double-completion (§E2).
   */
  async complete(member: MemberTokenPayload): Promise<{ message: string }> {
    return prisma.$transaction(async (tx) => {
      // Lock the session row — prevents concurrent completion
      const sessions = await tx.$queryRaw<
        Array<{ id: number; status: string; table_id: number; branch_id: number; restaurant_id: number }>
      >`
        SELECT ds.id, ds.status, ds.table_id, ds.branch_id, b.restaurant_id
        FROM dining_sessions ds
        JOIN branches b ON b.id = ds.branch_id
        WHERE ds.id = ${member.sessionId} AND ds.status = 'active'
        LIMIT 1
        FOR UPDATE
      `;

      const session = sessions[0];
      if (!session) {
        // Either not found or already completed by another concurrent request
        throw new AppError(
          'Session is not active or has already been completed',
          409,
          'SESSION_NOT_ACTIVE',
        );
      }

      // Guard 1: All non-cancelled orders must be in terminal state
      const nonTerminalOrders = await tx.order.count({
        where: {
          sessionId: member.sessionId,
          deletedAt: null,
          status: { notIn: ['delivered', 'cancelled'] },
        },
      });
      if (nonTerminalOrders > 0) {
        throw new AppError(
          `${nonTerminalOrders} order(s) are not yet delivered. Wait for all items to be served before completing.`,
          409,
          'ORDERS_NOT_COMPLETE',
        );
      }

      // Guard 2: No outstanding balance
      const invoiceResult = await tx.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM(oi.unit_price * oi.quantity), 0)::NUMERIC AS total
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.session_id = ${member.sessionId}
          AND o.deleted_at IS NULL
          AND oi.deleted_at IS NULL
          AND oi.status != 'cancelled'
      `;
      const paidResult = await tx.$queryRaw<Array<{ paid: number }>>`
        SELECT COALESCE(SUM(amount), 0)::NUMERIC AS paid
        FROM payments
        WHERE session_id = ${member.sessionId}
          AND status = 'completed'
      `;

      const invoiceTotal = Number(invoiceResult[0]?.total ?? 0);
      const totalPaid = Number(paidResult[0]?.paid ?? 0);

      if (totalPaid < invoiceTotal) {
        throw new AppError(
          `Outstanding balance of ${(invoiceTotal - totalPaid).toFixed(2)} must be paid before completing.`,
          409,
          'PAYMENT_REQUIRED',
        );
      }

      // All guards passed — complete session
      await tx.diningSession.update({
        where: { id: member.sessionId },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Table → cleaning
      await tx.table.update({
        where: { id: session.table_id },
        data: { status: 'cleaning' },
      });

      // Notify staff
      await tx.notification.create({
        data: {
          restaurantId: session.restaurant_id,
          branchId: session.branch_id,
          type: 'meal_completed',
          title: 'Meal completed',
          message: `Session #${member.sessionId} completed by customer. Table ready for cleaning.`,
          referenceType: 'dining_session',
          referenceId: member.sessionId,
        },
      });

      return { message: 'Meal completed. Thank you!' };
    });
  },
};
