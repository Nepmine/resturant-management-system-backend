import { z } from 'zod';

export const qrScanSchema = z.object({
  body: z.object({
    qrToken: z.string().min(64).max(64),
    // Optional member name — required when creating a NEW session; optional when joining existing
    name: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).optional(),
  }),
});
