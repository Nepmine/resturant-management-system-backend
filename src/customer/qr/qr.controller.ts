import type { Request, Response } from 'express';
import { qrService } from './qr.service';
import { sendSuccess } from '../../utils/apiResponse';
import type { QrScanDto } from './qr.dto';

export const qrController = {
  async scan(req: Request, res: Response) {
    const data = await qrService.scan(req.body as QrScanDto);
    sendSuccess(res, data);
  },
};
