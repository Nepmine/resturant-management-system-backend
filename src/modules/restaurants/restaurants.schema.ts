import { z } from 'zod';

export const createRestaurantSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    address: z.string().max(500).optional(),
    billingEmail: z.string().email().max(150).optional(),
  }),
});

export const updateRestaurantSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    address: z.string().max(500).optional(),
    billingEmail: z.string().email().max(150).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' },
  ),
});

export const restaurantParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
