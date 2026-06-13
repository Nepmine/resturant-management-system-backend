import { z } from 'zod';

export const customerMenuItemParamSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
});
