import { z } from "zod";

const forecastMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const droughtCategorySchema = z.enum(["none", "D0", "D1", "D2", "D3", "D4"]);

export const droughtForecastSchema = z.object({
  source: z.literal("IDEAM"),
  sourceUrl: z.string().url(),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hydrographicZone: z.string().min(1),
  geographyLevel: z.literal("hydrographic-zone"),
  aggregationMonths: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]),
  forecastStartMonth: forecastMonthSchema,
  months: z.array(z.object({
    month: forecastMonthSchema,
    category: droughtCategorySchema,
    indexValue: z.number().finite().nullable(),
  })).min(1),
});

export type DroughtForecast = z.infer<typeof droughtForecastSchema>;
export type DroughtCategory = z.infer<typeof droughtCategorySchema>;
