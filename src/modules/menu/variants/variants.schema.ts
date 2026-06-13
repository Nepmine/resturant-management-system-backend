import { z } from 'zod';

// ─── Shared ────────────────────────────────────────────────────────────────

export const variantItemParamSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
});

export const variantParamSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive(),
  }),
});

// ─── Create variant (group + initial options in one request) ───────────────
// §D7: "Create variant (option group + option)"
// We accept a group definition with an optional seed list of options for convenience.
export const createVariantSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    // Option group fields
    name: z.string().min(1).max(100),
    isRequired: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
    // Optional initial options within the group
    options: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          priceModifier: z.number().min(0).default(0),
          sortOrder: z.number().int().min(0).default(0),
        }),
      )
      .optional(),
  }),
});

// ─── Update variant (group-level fields) ──────────────────────────────────
export const updateVariantSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      isRequired: z.boolean().optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'At least one field must be provided',
    }),
});

// ─── Option-level CRUD (within a group) ────────────────────────────────────

export const optionParamSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive(),
    optionId: z.coerce.number().int().positive(),
  }),
});

export const createOptionSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(100),
    priceModifier: z.number().min(0).default(0),
    sortOrder: z.number().int().min(0).default(0),
  }),
});

export const updateOptionSchema = z.object({
  params: z.object({
    itemId: z.coerce.number().int().positive(),
    variantId: z.coerce.number().int().positive(),
    optionId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      priceModifier: z.number().min(0).optional(),
      sortOrder: z.number().int().min(0).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'At least one field must be provided',
    }),
});
