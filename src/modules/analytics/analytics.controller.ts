import type { Response } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';

export const analyticsController = {
  async getRevenue(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getRevenue(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getOrders(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getOrders(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getPayments(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getPayments(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getPeakHours(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getPeakHours(Number(req.params.branchId), req.user!.restaurantId);
    sendSuccess(res, data);
  },
  async getTopDishes(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getTopDishes(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getWorstDishes(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getWorstDishes(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getDishSales(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getDishSales(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getTableUtilization(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getTableUtilization(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getSessionDuration(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getSessionDuration(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getCustomerTrends(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getCustomerTrends(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getStaffPerformance(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getStaffPerformance(Number(req.params.branchId), req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
  async getBranchComparison(req: AuthenticatedStaffRequest, res: Response) {
    const data = await analyticsService.getBranchComparison(req.user!.restaurantId, req.query);
    sendSuccess(res, data);
  },
};
