import { z } from 'zod';
import { Router } from 'express';
import type { Response } from 'express';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import { memberAuth } from '../../middleware/memberAuth';
import { sendSuccess, sendCreated } from '../../utils/apiResponse';
import { branchRepository } from '../branches/branches.repository';
import { buildMeta, parsePagination } from '../../utils/pagination';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { AuthenticatedMemberRequest } from '../../types/express';

// ─── Schema ───────────────────────────────────────────────────────────────

const submitFeedbackSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  }),
});

const feedbackBranchParamSchema = z.object({
  params: z.object({ branchId: z.coerce.number().int().positive() }),
});

const feedbackListQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

// ─── DTO ──────────────────────────────────────────────────────────────────

interface FeedbackDto {
  id: number;
  sessionId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

interface FeedbackSummaryDto {
  branchId: number;
  avgRating: number | null;
  totalResponses: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  recent: FeedbackDto[];
}

function format(f: {
  id: number; sessionId: number; rating: number;
  comment: string | null; createdAt: Date;
}): FeedbackDto {
  return { id: f.id, sessionId: f.sessionId, rating: f.rating, comment: f.comment, createdAt: f.createdAt };
}

// ─── Service ──────────────────────────────────────────────────────────────

const feedbackService = {
  /**
   * POST /customer/feedback — Member JWT
   * One submission per session (idempotent — updates if already submitted).
   */
  async submit(sessionId: number, branchId: number, dto: { rating: number; comment?: string }): Promise<FeedbackDto> {
    const session = await prisma.diningSession.findFirst({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) throw new AppError('Session not found', 404, 'NOT_FOUND');

    // Upsert — one feedback per session
    const existing = await prisma.customerFeedback.findFirst({ where: { sessionId } });
    if (existing) {
      const updated = await prisma.customerFeedback.update({
        where: { id: existing.id },
        data: { rating: dto.rating, comment: dto.comment ?? null },
      });
      return format(updated);
    }

    const fb = await prisma.customerFeedback.create({
      data: { sessionId, rating: dto.rating, comment: dto.comment ?? null },
    });
    return format(fb);
  },

  /**
   * GET /branches/:branchId/feedback — Manager+
   * Returns avg rating, distribution, and paginated recent feedback.
   */
  async listForBranch(
    branchId: number,
    restaurantId: number,
    query: any,
  ): Promise<FeedbackSummaryDto> {
    const branch = await branchRepository.findById(branchId, restaurantId);
    if (!branch) throw new AppError('Branch not found', 404, 'NOT_FOUND');

    const { skip, take } = parsePagination(query);

    const [agg, distribution, recent] = await Promise.all([
      prisma.customerFeedback.aggregate({
        where: { session: { branchId } },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.$queryRaw<Array<{ rating: number; count: bigint }>>`
        SELECT cf.rating, COUNT(*)::INT AS count
        FROM customer_feedback cf
        JOIN dining_sessions ds ON ds.id = cf.session_id
        WHERE ds.branch_id = ${branchId}
        GROUP BY cf.rating
        ORDER BY cf.rating ASC
      `,
      prisma.customerFeedback.findMany({
        where: { session: { branchId } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distribution as any[]) {
      dist[row.rating] = Number(row.count);
    }

    return {
      branchId,
      avgRating: agg._avg.rating != null ? +Number(agg._avg.rating).toFixed(2) : null,
      totalResponses: agg._count.id,
      distribution: dist as any,
      recent: recent.map(format),
    };
  },
};

// ─── Controllers ──────────────────────────────────────────────────────────

const customerFeedbackController = {
  async submit(req: AuthenticatedMemberRequest, res: Response) {
    const data = await feedbackService.submit(
      req.member!.sessionId, req.member!.branchId, req.body,
    );
    sendCreated(res, data);
  },
};

const staffFeedbackController = {
  async list(req: AuthenticatedStaffRequest, res: Response) {
    const data = await feedbackService.listForBranch(
      Number(req.params.branchId), req.user!.restaurantId, req.query,
    );
    sendSuccess(res, data);
  },
};

// ─── Customer feedback router ─────────────────────────────────────────────

export const customerFeedbackRouter = Router();

customerFeedbackRouter.post(
  '/',
  memberAuth,
  validate({ body: submitFeedbackSchema.shape.body }),
  asyncHandler(customerFeedbackController.submit),
);

// ─── Staff feedback router ─────────────────────────────────────────────────
// Mounted under /branches/:branchId/feedback in app.ts (mergeParams: true)

const staffFeedbackRouter = Router({ mergeParams: true });

staffFeedbackRouter.get(
  '/',
  validate({
    params: feedbackBranchParamSchema.shape.params,
    query: feedbackListQuerySchema.shape.query,
  }),
  authenticate, resolveTenant, authorize('manager'),
  asyncHandler(staffFeedbackController.list),
);

export default staffFeedbackRouter;
