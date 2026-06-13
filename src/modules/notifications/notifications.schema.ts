import { z } from 'zod';
import { paginationQuery, updatedAfterQuery } from '../../middleware/validate';

export const notificationParamSchema = z.object({
  params: z.object({ notificationId: z.coerce.bigint() }),
});

export const notificationsQuerySchema = z.object({
  query: paginationQuery.merge(updatedAfterQuery),
});
