import type { Response } from 'express';
import { tableService } from './tables.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/apiResponse';
import type { AuthenticatedStaffRequest } from '../../types/express';
import type { CreateTableDto, UpdateTableDto } from './tables.dto';
import type { TableStatus } from '@prisma/client';

export const tableController = {
  // ─── CRUD ───────────────────────────────────────────────────────────────

  async list(req: AuthenticatedStaffRequest, res: Response) {
    const { sectionId, status } = req.query as {
      sectionId?: string;
      status?: string;
    };

    const data = await tableService.list(
      Number(req.params.branchId),
      req.user!.restaurantId,
      {
        sectionId: sectionId ? Number(sectionId) : undefined,
        status: status as TableStatus | undefined,
      },
    );
    sendSuccess(res, data);
  },

  async create(req: AuthenticatedStaffRequest, res: Response) {
    const data = await tableService.create(
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as CreateTableDto,
    );
    sendCreated(res, data);
  },

  async update(req: AuthenticatedStaffRequest, res: Response) {
    const data = await tableService.update(
      Number(req.params.tableId),
      Number(req.params.branchId),
      req.user!.restaurantId,
      req.body as UpdateTableDto,
    );
    sendSuccess(res, data);
  },

  async softDelete(req: AuthenticatedStaffRequest, res: Response) {
    await tableService.softDelete(
      Number(req.params.tableId),
      Number(req.params.branchId),
      req.user!.restaurantId,
    );
    sendNoContent(res);
  },

  // ─── QR ─────────────────────────────────────────────────────────────────

  async getQr(req: AuthenticatedStaffRequest, res: Response) {
    const data = await tableService.getQr(
      Number(req.params.tableId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    // Return SVG directly when Accept: image/svg+xml, otherwise JSON
    const accept = req.headers.accept ?? '';
    if (accept.includes('image/svg+xml')) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(data.svg);
    } else {
      sendSuccess(res, data);
    }
  },

  async regenerateQr(req: AuthenticatedStaffRequest, res: Response) {
    const data = await tableService.regenerateQr(
      Number(req.params.tableId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  // ─── Status transitions ──────────────────────────────────────────────────

  async markCleaning(req: AuthenticatedStaffRequest, res: Response) {
    const data = await tableService.markCleaning(
      Number(req.params.tableId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },

  async markAvailable(req: AuthenticatedStaffRequest, res: Response) {
    const data = await tableService.markAvailable(
      Number(req.params.tableId),
      req.user!.branchId!,
      req.user!.restaurantId,
    );
    sendSuccess(res, data);
  },
};
