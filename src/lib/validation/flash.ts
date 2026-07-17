import { z } from "zod";

export const categorySchema = z.enum([
  "Electronics",
  "Stationery",
  "Project Materials",
  "Repair Essentials",
]);

export const requestIdSchema = z.string().uuid();
export const offerIdSchema = z.string().uuid();

export const flashRequestInputSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  category: categorySchema,
  quantity: z.number().int().positive().max(999),
  maxPrice: z.number().nonnegative().max(1_000_000).nullable().optional(),
  urgencyMinutes: z.union([z.literal(30), z.literal(60), z.literal(120)]),
});

export const flashOfferInputSchema = z.object({
  productName: z.string().trim().min(2).max(160),
  quantityAvailable: z.number().int().positive().max(9999),
  unitPrice: z.number().nonnegative().max(1_000_000),
  note: z.string().trim().max(500).optional(),
  readyMinutes: z.number().int().positive().max(1440),
  expirationMinutes: z.number().int().min(5).max(120).default(30),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: categorySchema.optional(),
});
