import { z } from "zod";

export const CLIMATE_PARAMETERS = ["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "EVLAND", "GWETROOT", "ALLSKY_SFC_SW_DWN"] as const;
const score = z.number().min(0).max(5);

export const climateRecordSchema = z.object({
  date: z.string().regex(/^\d{8}$/, "La fecha debe tener formato YYYYMMDD"),
  T2M: z.number().nullable(), T2M_MIN: z.number().nullable(), T2M_MAX: z.number().nullable(),
  PRECTOTCORR: z.number().nullable(), EVLAND: z.number().nullable(), GWETROOT: z.number().nullable(),
  ALLSKY_SFC_SW_DWN: z.number().nullable(),
});
export type ClimateRecord = z.infer<typeof climateRecordSchema>;
export type ClimateParameter = (typeof CLIMATE_PARAMETERS)[number];

export const monthlyClimateSchema = z.object({
  year: z.number().int().min(1981), month: z.number().int().min(1).max(12),
  meanTemperatureC: z.number().nullable(), precipitationMm: z.number().nullable(), evaporationMm: z.number().nullable(),
  rootZoneWetness: z.number().min(0).max(1).nullable(), missingByParameter: z.record(z.string(), z.number().int().nonnegative()),
  // Opcionales para no romper consumidores previos; aggregateMonthly siempre los entrega.
  minTemperatureC: z.number().nullable().optional(), maxTemperatureC: z.number().nullable().optional(),
});
export type MonthlyClimate = z.infer<typeof monthlyClimateSchema>;

/** Valor de un indicador junto con cuántos datos diarios faltaron (null) y no pudieron usarse. */
export type IndicatorValue<T> = { value: T; missing: number };

/** Balance hídrico mensual: lluvia − evaporación (negativo = déficit; mismo criterio que `Indicators.waterDeficitMm`). */
export const monthlyWaterDeficitSchema = z.object({
  year: z.number().int().min(1981), month: z.number().int().min(1).max(12),
  waterDeficitMm: z.number().nullable(), missing: z.number().int().nonnegative(),
});
export type MonthlyWaterDeficit = z.infer<typeof monthlyWaterDeficitSchema>;

/** Humedad de zona radicular del mes y su anomalía (diferencia) frente al promedio histórico del mismo mes. */
export const monthlyWetnessAnomalySchema = z.object({
  year: z.number().int().min(1981), month: z.number().int().min(1).max(12),
  meanWetness: z.number().min(0).max(1).nullable(), historicalMeanWetness: z.number().min(0).max(1).nullable(),
  anomaly: z.number().nullable(), missing: z.number().int().nonnegative(),
});
export type MonthlyWetnessAnomaly = z.infer<typeof monthlyWetnessAnomalySchema>;

export const indicatorsSchema = z.object({
  waterDeficitMm: z.number().nullable(), heatStressDays: z.number().int().nonnegative(), frostRiskDays: z.number().int().nonnegative(),
  extremeRainThresholdMm: z.number().nonnegative().nullable(), meanRootZoneWetness: z.number().min(0).max(1).nullable(),
  missingByParameter: z.record(z.string(), z.number().int().nonnegative()),
});
export type Indicators = z.infer<typeof indicatorsSchema>;

export const cropSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), waterUse: score, nitrogenFixation: score, erosionReduction: score,
  organicMatter: score, forageValue: score, marketPotential: score, heatTolerance: score, droughtTolerance: score,
  cycleDays: z.number().int().positive(), sowingMonths: z.array(z.number().int().min(1).max(12)), source: z.string().min(1),
});
export type Crop = z.infer<typeof cropSchema>;

export const rotationSchema = z.object({ id: z.string().min(1), name: z.string().min(1), cropIds: z.array(z.string().min(1)).min(1), description: z.string().min(1) });
export type Rotation = z.infer<typeof rotationSchema>;

export const userPrioritiesSchema = z.object({
  waterSaving: score, extraIncome: score, soilImprovement: score, erosionReduction: score, lowRisk: score,
  currentCropId: z.string().min(1).optional(), waterAvailability: z.enum(["low", "medium", "high"]).optional(),
});
export type UserPriorities = z.infer<typeof userPrioritiesSchema>;

export const farmCoordinateSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lon: z.number().finite().gte(-180).lte(180),
});

const geoJsonPositionSchema = z.tuple([
  z.number().finite().gte(-180).lte(180),
  z.number().finite().gte(-90).lte(90),
]);

const terrainSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("point") }),
  z.object({
    kind: z.literal("approx_size"),
    areaHa: z.number().finite().positive(),
    areaRangeHa: z.tuple([z.number().finite().positive(), z.number().finite().positive()])
      .refine(([minimum, maximum]) => minimum < maximum, "El rango de área debe crecer"),
  }),
  z.object({
    kind: z.literal("polygon"),
    areaHa: z.number().finite().positive(),
    // GeoJSON positions use [longitude, latitude], and the last point closes the ring.
    ring: z.array(geoJsonPositionSchema).min(4).refine((ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      return first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1];
    }, "El anillo debe cerrar en su primera coordenada"),
  }),
]);

export const farmSchema = z.object({
  centroid: farmCoordinateSchema,
  locationSource: z.enum(["gps", "search", "map"]),
  placeLabel: z.string().min(1).optional(),
  accuracyM: z.number().finite().nonnegative().optional(),
  terrain: terrainSchema,
}).refine((farm) => farm.accuracyM === undefined || farm.locationSource === "gps", {
  message: "accuracyM solo aplica a ubicaciones obtenidas por GPS",
  path: ["accuracyM"],
});
export type Farm = z.infer<typeof farmSchema>;
export type FarmTerrain = z.infer<typeof terrainSchema>;

export const rotationResultSchema = z.object({
  rotation: rotationSchema, score: z.number(), whySuggested: z.string().min(1), evidence: z.array(z.string().min(1)).min(1),
  benefits: z.array(z.string().min(1)).min(1), informationGaps: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string().min(1)).min(1), validateWithLocalExpert: z.array(z.string().min(1)).min(1),
});
export type RotationResult = z.infer<typeof rotationResultSchema>;

export const climateResultSchema = z.object({
  records: z.array(climateRecordSchema),
  missingByParameter: z.record(z.string(), z.number().int().nonnegative()),
  source: z.enum(["live", "cache", "sample"]),
});
export type ClimateResult = z.infer<typeof climateResultSchema>;

export const climateRequestSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90), lon: z.number().finite().gte(-180).lte(180),
  startYear: z.number().int().min(1981), endYear: z.number().int().min(1981),
});
export type ClimateRequest = z.infer<typeof climateRequestSchema>;

export const analysisRequestSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90), lon: z.number().finite().gte(-180).lte(180),
  startYear: z.number().int().min(1981), endYear: z.number().int().min(1981), priorities: userPrioritiesSchema,
  // Climate should use farm.centroid when a Farm is supplied; lat/lon remain for older clients.
  farm: farmSchema.optional(),
}).refine((value) => value.startYear <= value.endYear, "startYear debe ser menor o igual que endYear");
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

export const analysisResponseSchema = z.object({
  climate: climateResultSchema, monthlyClimate: z.array(monthlyClimateSchema), indicators: indicatorsSchema, rotations: z.array(rotationResultSchema).min(3),
});
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export const locationBoundingBoxSchema = z.tuple([
  z.number().finite().gte(-90).lte(90),
  z.number().finite().gte(-90).lte(90),
  z.number().finite().gte(-180).lte(180),
  z.number().finite().gte(-180).lte(180),
]).refine(([south, north, west, east]) => south <= north && west <= east, "El bounding box debe estar ordenado");
export type LocationBoundingBox = z.infer<typeof locationBoundingBoxSchema>;

export const locationResultSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lon: z.number().finite().gte(-180).lte(180),
  label: z.string().min(1),
  boundingBox: locationBoundingBoxSchema.optional(),
});
export type LocationResult = z.infer<typeof locationResultSchema>;
