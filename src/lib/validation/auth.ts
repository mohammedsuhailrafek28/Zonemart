import { z } from "zod";

export const roleSchema = z.enum(["customer", "vendor"]);

export const zoneSchema = z.enum(["Anna Nagar", "T Nagar", "Velachery"]);

export const profileInputSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  role: roleSchema,
  zone: zoneSchema,
});

export type ZoneMartRole = z.infer<typeof roleSchema>;
