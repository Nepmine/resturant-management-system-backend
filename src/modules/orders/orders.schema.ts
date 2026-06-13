import { z } from 'zod';
import { paginationQuery, updatedAfterQuery } from '../../middleware/validate';

export const orderBranchParamSchema = z.object({
  params: z.object({
    branchId: z.coerce.number().int().positive(),
  }),
});

export const orderParamSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
});

export const orderItemParamSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
    itemId: z.coerce.number().int().positive(),
  }),
});

export const orderListQuerySchema = z.object({
  query: paginationQuery
    .merge(updatedAfterQuery)
    .extend({
      status: z
        .enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'])
        .optional(),
      orderType: z.enum(['dine_in', 'parcel']).optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
    }),
});

// Staff can only manually advance: pending → confirmed
export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.literal('confirmed'),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
});

export const cancelOrderItemSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
    itemId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
});

// Parcel order creation (staff-placed, no session)
export const createParcelOrderSchema = z.object({
  body: z.object({
    customerName: z.string().min(1).max(100),
    customerPhone: z.string().min(1).max(20),
    note: z.string().max(500).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.number().int().positive(),
          variantId: z.number().int().positive().optional(),
          quantity: z.number().int().min(1).max(50),
          note: z.string().max(255).optional(),
        }),
      )
      .min(1),
  }),
});
