import { z } from 'zod';
import { paginationQuery } from '../../middleware/validate';

export const staffParamSchema = z.object({
  params: z.object({ staffId: z.coerce.number().int().positive() }),
});

export const staffListQuerySchema = z.object({
  query: paginationQuery,
});

export const inviteStaffSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(150),
    role: z.enum(['staff', 'manager', 'admin']).default('staff'),
    branchId: z.number().int().positive().optional(),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({ staffId: z.coerce.number().int().positive() }),
  body: z.object({
    role: z.enum(['staff', 'manager', 'admin']),
    branchId: z.number().int().positive().nullable().optional(),
  }),
});

export const staffLogsQuerySchema = z.object({
  params: z.object({ staffId: z.coerce.number().int().positive() }),
  query: paginationQuery,
});
