import { z } from "zod";
import { categorySchema } from "@/lib/validation/flash";
import { productIdSchema } from "@/lib/validation/commerce";

const optionalDisplay = (max: number) => z.string().trim().max(max).optional();

export const vendorStoreInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: optionalDisplay(1000),
    address: optionalDisplay(500),
    contactDisplay: optionalDisplay(200),
    operatingHours: optionalDisplay(300),
  })
  .strict();

export const vendorProductInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).default(""),
    category: categorySchema,
    price: z.number().nonnegative().max(1_000_000),
    stock: z.number().int().nonnegative().max(1_000_000),
    imageUrl: z.string().url().max(2000).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();

export { productIdSchema };

export const orderIdSchema = z.string().uuid();

export const pickupCodeSchema = z.object({
  pickupCode: z.string().trim().length(6).regex(/^[A-Za-z0-9]+$/),
});

export const vendorOrderFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum(["reserved", "ready", "completed", "cancelled", "expired"])
    .optional(),
  source: z.enum(["listed", "flash"]).optional(),
});
