import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { waiterRequestRepository } from '../../modules/waiter-requests/waiter-requests.repository';
import type { MemberTokenPayload } from '../../types/express';
import type { WaiterRequestDto } from '../../modules/waiter-requests/waiter-requests.dto';

function format(r: {
  id: number; sessionId: number; type: string; status: string;
  resolvedById: number | null; resolvedAt: Date | null;
  acknowledgedAt: Date | null; createdAt: Date;
}): WaiterRequestDto {
  return { id: r.id, sessionId: r.sessionId, type: r.type, status: r.status,
    resolvedBy: r.resolvedById, resolvedAt: r.resolvedAt,
    acknowledgedAt: r.acknowledgedAt, createdAt: r.createdAt };
}

export const customerWaiterRequestService = {
  /**
   * POST /customer/waiter-requests
   * Inserts request + notifies branch staff.
   * Throttle: only one pending request of the same type per session at a time.
   */
  async submit(
    member: MemberTokenPayload,
    type: string,
  ): Promise<WaiterRequestDto> {
    return prisma.$transaction(async (tx) => {
      // Verify session active
      const session = await tx.diningSession.findFirst({
        where: { id: member.sessionId, status: 'active' },
        select: { id: true, branchId: true },
      });
      if (!session) throw new AppError('Session is not active', 400, 'SESSION_NOT_ACTIVE');

      // Prevent duplicate pending requests of same type
      const existing = await tx.waiterRequest.findFirst({
        where: { sessionId: member.sessionId, type: type as any, status: { in: ['pending', 'acknowledged'] } },
      });
      if (existing) {
        throw new AppError(
          'A pending request of this type already exists',
          409,
          'DUPLICATE_REQUEST',
        );
      }

      const request = await waiterRequestRepository.create(
        { sessionId: member.sessionId, type },
        tx,
      );

      // Notify branch staff
      const branchData = await tx.branch.findUnique({
        where: { id: member.branchId },
        select: { restaurantId: true },
      });
      await tx.notification.create({
        data: {
          restaurantId: branchData!.restaurantId,
          branchId: member.branchId,
          type: 'waiter_called',
          title: typeLabel(type),
          message: `Session #${member.sessionId} requests: ${typeLabel(type)}`,
          referenceType: 'waiter_request',
          referenceId: request.id,
        },
      });

      return format(request);
    });
  },

  async listForSession(
    member: MemberTokenPayload,
    updatedAfter?: Date,
  ): Promise<WaiterRequestDto[]> {
    const rows = await waiterRequestRepository.findBySession(member.sessionId, updatedAfter);
    return rows.map(format);
  },
};

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    call_waiter: 'Waiter requested',
    request_water: 'Water requested',
    request_tissue: 'Tissue requested',
  };
  return labels[type] ?? type;
}
