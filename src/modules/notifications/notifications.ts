import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { buildMeta, parsePagination } from '../../utils/pagination';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { Response } from 'express';
import { sendSuccess, sendNoContent } from '../../utils/apiResponse';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import { Router } from 'express';
import {
  notificationParamSchema,
  notificationsQuerySchema,
} from './notifications.schema';

// ─── DTO ──────────────────────────────────────────────────────────────────

interface NotificationDto {
  id: string;        // BigInt serialized as string
  restaurantId: number;
  branchId: number | null;
  staffId: number | null;
  type: string;
  title: string;
  message: string | null;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  createdAt: Date;
}

function format(n: {
  id: bigint; restaurantId: number; branchId: number | null;
  staffId: number | null; type: string; title: string;
  message: string | null; referenceType: string | null;
  referenceId: number | null; isRead: boolean; createdAt: Date;
}): NotificationDto {
  return { ...n, id: n.id.toString() };
}

// ─── Service ──────────────────────────────────────────────────────────────

const notificationService = {
  /**
   * GET /notifications — Staff+
   * §D19: HTTP polling model. ?updatedAfter=<ISO> returns only new rows.
   * Scoped to current staff (staffId) OR branch-wide (staffId IS NULL).
   */
  async list(staffId: number, branchId: number | null, restaurantId: number, query: any) {
    const { skip, take } = parsePagination(query);
    const updatedAfter   = query.updatedAfter ? new Date(query.updatedAfter) : undefined;

    const where = {
      restaurantId,
      OR: [
        { staffId },
        ...(branchId ? [{ branchId, staffId: null }] : []),
      ],
      ...(updatedAfter && { createdAt: { gt: updatedAfter } }),
    };

    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    return { data: rows.map(format), meta: buildMeta(total, skip, take) };
  },

  async markRead(notificationId: bigint, staffId: number): Promise<NotificationDto> {
    const n = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || (n.staffId !== null && n.staffId !== staffId)) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    return format(updated);
  },

  async markAllRead(staffId: number, branchId: number | null, restaurantId: number): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        restaurantId,
        isRead: false,
        OR: [
          { staffId },
          ...(branchId ? [{ branchId, staffId: null }] : []),
        ],
      },
      data: { isRead: true },
    });
  },
};

// ─── Controller ───────────────────────────────────────────────────────────

const notificationController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const result = await notificationService.list(
      req.user!.sub, req.user!.branchId, req.user!.restaurantId, req.query,
    );
    res.json({ success: true, ...result });
  },

  async markRead(req: AuthenticatedStaffRequest, res: Response) {
    const data = await notificationService.markRead(
      BigInt(req.params.notificationId), req.user!.sub,
    );
    sendSuccess(res, data);
  },

  async markAllRead(req: AuthenticatedStaffRequest, res: Response) {
    await notificationService.markAllRead(
      req.user!.sub, req.user!.branchId, req.user!.restaurantId,
    );
    sendNoContent(res);
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];
const router = Router();

router.get(
  '/',
  validate({ query: notificationsQuerySchema.shape.query }),
  ...staffPipeline,
  asyncHandler(notificationController.list),
);

router.patch(
  '/read-all',
  ...staffPipeline,
  asyncHandler(notificationController.markAllRead),
);

router.patch(
  '/:notificationId/read',
  validate({ params: notificationParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(notificationController.markRead),
);

export default router;
