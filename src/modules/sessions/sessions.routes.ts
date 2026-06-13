import { Router } from 'express';
import { sessionController } from './sessions.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  sessionBranchParamSchema,
  sessionParamSchema,
} from './sessions.schema';

const staffPipeline = [authenticate, resolveTenant, authorize('staff')];

// ─── Branch-nested: /branches/:branchId/sessions ───────────────────────────
export const branchSessionsRouter = Router({ mergeParams: true });

// GET /branches/:branchId/sessions/active — Staff+
branchSessionsRouter.get(
  '/active',
  validate({ params: sessionBranchParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(sessionController.listActive),
);

// ─── Root-level: /sessions/:sessionId ─────────────────────────────────────
const sessionsRouter = Router();

// GET /sessions/:sessionId — Staff+
sessionsRouter.get(
  '/:sessionId',
  validate({ params: sessionParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(sessionController.getById),
);

// POST /sessions/:sessionId/close — Staff+
sessionsRouter.post(
  '/:sessionId/close',
  validate({ params: sessionParamSchema.shape.params }),
  ...staffPipeline,
  asyncHandler(sessionController.close),
);

export default sessionsRouter;
