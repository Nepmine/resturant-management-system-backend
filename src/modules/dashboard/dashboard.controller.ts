import type { Response } from 'express';
import { dashboardService } from './dashboard.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';

export const dashboardController = {
  async getStaffDashboard(req: AuthenticatedStaffRequest, res: Response) {
    const data = await dashboardService.getStaffDashboard(
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async getBranchDashboard(req: AuthenticatedStaffRequest, res: Response) {
    const data = await dashboardService.getBranchDashboard(
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async getAdminDashboard(req: AuthenticatedStaffRequest, res: Response) {
    const data = await dashboardService.getAdminDashboard(req.user!.restaurantId);
    sendSuccess(res, data);
  },
};
