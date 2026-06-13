import { z } from 'zod';
import { updatedAfterQuery } from '../../middleware/validate';

export const customerOrderParamSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
});

export const customerOrderQuerySchema = z.object({
  query: updatedAfterQuery,
});

const orderItemInputSchema = z.object({
  menuItemId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(50),
  note: z.string().max(255).optional(),
});

export const placeOrderSchema = z.object({
  body: z.object({
    note: z.string().max(500).optional(),
    items: z.array(orderItemInputSchema).min(1),
  }),
});

export const addItemsSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    items: z.array(orderItemInputSchema).min(1),
  }),
});

export const cancelCustomerOrderSchema = z.object({
  params: z.object({
    orderId: z.coerce.number().int().positive(),
  }),
});
