import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { resolveTenant } from '../../middleware/tenant';
import {
  analyticsBranchParamSchema,
  analyticsRestaurantParamSchema,
  periodQuerySchema,
} from './analytics.schema';

const managerPipeline = [authenticate, resolveTenant, authorize('manager')];
const adminPipeline   = [authenticate, resolveTenant, authorize('admin')];

// ─── Branch analytics: /branches/:branchId/analytics/* ────────────────────
export const branchAnalyticsRouter = Router({ mergeParams: true });

const bp = analyticsBranchParamSchema.shape.params;
const pq = periodQuerySchema.shape.query;

branchAnalyticsRouter.get('/revenue',            validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getRevenue));
branchAnalyticsRouter.get('/orders',             validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getOrders));
branchAnalyticsRouter.get('/payments',           validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getPayments));
branchAnalyticsRouter.get('/peak-hours',         validate({ params: bp }), ...managerPipeline, asyncHandler(analyticsController.getPeakHours));
branchAnalyticsRouter.get('/top-dishes',         validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getTopDishes));
branchAnalyticsRouter.get('/worst-dishes',       validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getWorstDishes));
branchAnalyticsRouter.get('/dish-sales',         validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getDishSales));
branchAnalyticsRouter.get('/table-utilization',  validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getTableUtilization));
branchAnalyticsRouter.get('/session-duration',   validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getSessionDuration));
branchAnalyticsRouter.get('/customer-trends',    validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getCustomerTrends));
branchAnalyticsRouter.get('/staff-performance',  validate({ params: bp, query: pq }), ...managerPipeline, asyncHandler(analyticsController.getStaffPerformance));

// ─── Restaurant analytics: /restaurants/:id/analytics/* ───────────────────
export const restaurantAnalyticsRouter = Router({ mergeParams: true });

restaurantAnalyticsRouter.get(
  '/branch-comparison',
  validate({ params: analyticsRestaurantParamSchema.shape.params, query: pq }),
  ...adminPipeline,
  asyncHandler(analyticsController.getBranchComparison),
);
