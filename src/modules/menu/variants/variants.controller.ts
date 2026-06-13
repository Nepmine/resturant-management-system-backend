import type { Response } from 'express';
import { variantService } from './variants.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../../types/express';
import type {
  CreateVariantDto,
  UpdateVariantDto,
  CreateOptionDto,
  UpdateOptionDto,
} from './variants.dto';

export const variantController = {
  // ─── Group operations ───────────────────────────────────────────────────

  async createGroup(req: AuthenticatedStaffRequest, res: Response) {
    const data = await variantService.createGroup(
      Number(req.params.itemId),
      req.user!.branchId!,
      req.body as CreateVariantDto,
    );
    sendCreated(res, data);
  },

  async updateGroup(req: AuthenticatedStaffRequest, res: Response) {
    const data = await variantService.updateGroup(
      Number(req.params.variantId),
      Number(req.params.itemId),
      req.user!.branchId!,
      req.body as UpdateVariantDto,
    );
    sendSuccess(res, data);
  },

  async softDeleteGroup(req: AuthenticatedStaffRequest, res: Response) {
    await variantService.softDeleteGroup(
      Number(req.params.variantId),
      Number(req.params.itemId),
      req.user!.branchId!,
    );
    sendNoContent(res);
  },

  // ─── Option operations ──────────────────────────────────────────────────

  async createOption(req: AuthenticatedStaffRequest, res: Response) {
    const data = await variantService.createOption(
      Number(req.params.variantId),
      Number(req.params.itemId),
      req.user!.branchId!,
      req.body as CreateOptionDto,
    );
    sendCreated(res, data);
  },

  async updateOption(req: AuthenticatedStaffRequest, res: Response) {
    const data = await variantService.updateOption(
      Number(req.params.optionId),
      Number(req.params.variantId),
      Number(req.params.itemId),
      req.user!.branchId!,
      req.body as UpdateOptionDto,
    );
    sendSuccess(res, data);
  },

  async softDeleteOption(req: AuthenticatedStaffRequest, res: Response) {
    await variantService.softDeleteOption(
      Number(req.params.optionId),
      Number(req.params.variantId),
      Number(req.params.itemId),
      req.user!.branchId!,
    );
    sendNoContent(res);
  },
};
