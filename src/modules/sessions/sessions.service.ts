import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { branchRepository } from '../branches/branches.repository';
import { sessionRepository } from './sessions.repository';
import type {
  SessionSummaryDto,
  SessionDetailDto,
  SessionMemberDto,
} from './sessions.dto';

// ─── formatters ────────────────────────────────────────────────────────────

function formatMember(m: {
  id: number;
  name: string;
  phone: string | null;
  joinedAt: Date;
}): SessionMemberDto {
  return { id: m.id, name: m.name, phone: m.phone, joinedAt: m.joinedAt };
}

type RawSession = {
  id: number;
  tableId: number;
  branchId: number;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  table: {
    id: number;
    tableNumber: number;
    label: string | null;
    section: { name: string };
  };
  members: Array<{ id: number; name: string; phone: string | null; joinedAt: Date }>;
};

function formatSummary(s: RawSession): SessionSummaryDto {
  return {
    id: s.id,
    tableId: s.tableId,
    tableNumber: s.table.tableNumber,
    tableLabel: s.table.label,
    sectionName: s.table.section.name,
    branchId: s.branchId,
    status: s.status,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    memberCount: s.members.length,
  };
}

function formatDetail(
  s: RawSession & {
    orders: Array<{
      id: number;
      status: string;
      payments: Array<{ amount: number | { toNumber(): number } }>;
    }>;
  },
): SessionDetailDto {
  const totalRevenue = s.orders.reduce((sum, o) => {
    return (
      sum +
      o.payments.reduce((ps, p) => {
        const amt = typeof p.amount === 'object' ? p.amount.toNumber() : Number(p.amount);
        return ps + amt;
      }, 0)
    );
  }, 0);

  return {
    ...formatSummary(s),
    members: s.members.map(formatMember),
    orderCount: s.orders.length,
    totalRevenue,
  };
}

// ─── service ───────────────────────────────────────────────────────────────

export const sessionService = {
  /**
   * GET /branches/:branchId/sessions/active — Staff+
   */
  async listActive(
    branchId: number,
    restaurantId: number,
  ): Promise<SessionSummaryDto[]> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const sessions = await sessionRepository.findActive(branchId);
    return sessions.map(formatSummary);
  },

  /**
   * GET /sessions/:sessionId — Staff+
   * Returns full session with members + order count + total revenue.
   */
  async getById(
    sessionId: number,
    restaurantId: number,
  ): Promise<SessionDetailDto> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');

    // Ensure session belongs to this restaurant (via branch)
    const branch = await branchRepository.findById(session.branchId, restaurantId);
    if (!branch) throw new AppError('Session not found', 404, 'NOT_FOUND');

    return formatDetail(session as any);
  },

  /**
   * POST /sessions/:sessionId/close — Staff+
   *
   * Closes the session: status → completed, table → cleaning.
   * Staff-initiated close (as opposed to customer-initiated via /customer/session/complete).
   *
   * Unlike the customer flow, staff close does NOT require all orders to be terminal —
   * staff have authority to close at any time (e.g. customer walked out).
   * A notification is inserted so other staff know the table moved to cleaning.
   */
  async close(
    sessionId: number,
    branchId: number,
    restaurantId: number,
    staffId: number,
  ): Promise<SessionSummaryDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      // Lock the session row
      const sessions = await tx.$queryRaw<
        Array<{ id: number; status: string; table_id: number; branch_id: number }>
      >`
        SELECT id, status, table_id, branch_id
        FROM dining_sessions
        WHERE id = ${sessionId} AND branch_id = ${branchId}
        LIMIT 1
        FOR UPDATE
      `;

      const session = sessions[0];
      if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');
      if (session.status !== 'active') {
        throw new AppError(
          `Session is already ${session.status}`,
          409,
          'SESSION_NOT_ACTIVE',
        );
      }

      // Close session → table to cleaning
      await sessionRepository.close(sessionId, tx);
      await tx.table.update({
        where: { id: session.table_id },
        data: { status: 'cleaning' },
      });

      // Notify branch staff
      await tx.notification.create({
        data: {
          restaurantId,
          branchId,
          type: 'meal_completed',
          title: 'Session closed',
          message: `Session #${sessionId} closed by staff. Table ready for cleaning.`,
          referenceType: 'dining_session',
          referenceId: sessionId,
        },
      });

      const updated = await sessionRepository.findById(sessionId, tx);
      return formatSummary(updated as any);
    });
  },
};
