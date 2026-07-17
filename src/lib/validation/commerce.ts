import { z } from "zod";

export const productIdSchema = z.string().uuid();

export const quantitySchema = z.number().int().positive().max(999);

export const cartItemSchema = z.object({
  productId: productIdSchema,
  quantity: quantitySchema,
  replaceCart: z.boolean().optional().default(false),
});

export const quantityInputSchema = z.object({
  quantity: quantitySchema,
});
