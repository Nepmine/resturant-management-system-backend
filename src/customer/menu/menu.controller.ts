import type { Response } from 'express';
import { customerMenuService } from './menu.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { AuthenticatedMemberRequest } from '../../types/express';

export const customerMenuController = {
  async getFullMenu(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerMenuService.getFullMenu(req.member!);
    sendSuccess(res, data);
  },

  async getCategories(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerMenuService.getCategories(req.member!);
    sendSuccess(res, data);
  },

  async getItemById(req: AuthenticatedMemberRequest, res: Response) {
    const data = await customerMenuService.getItemById(
      Number(req.params.itemId),
      req.member!,
    );
    sendSuccess(res, data);
  },
};
