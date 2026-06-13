import { z } from 'zod';

export const itemCategoryParamSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
  }),
});

export const itemParamSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
});

export const createItemSchema = z.object({
  params: z.object({
    categoryId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(150),
    description: z.string().max(1000).optional(),
    basePrice: z.number().positive(),
    imageUrl: z.string().url().max(500).optional(),
    isAvailable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  }),
});

export const updateItemSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(150).optional(),
      description: z.string().max(1000).optional(),
      basePrice: z.number().positive().optional(),
      imageUrl: z.string().url().max(500).nullable().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const availabilitySchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    isAvailable: z.boolean(),
    // Optional note shown to customers when item is unavailable
    disableNote: z.string().max(255).optional().nullable(),
  }),
});
