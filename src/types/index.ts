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
});
export type MonthlyClimate = z.infer<typeof monthlyClimateSchema>;

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
}).refine((value) => value.startYear <= value.endYear, "startYear debe ser menor o igual que endYear");
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

export const analysisResponseSchema = z.object({
  climate: climateResultSchema, monthlyClimate: z.array(monthlyClimateSchema), indicators: indicatorsSchema, rotations: z.array(rotationResultSchema).min(3),
});
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export const locationResultSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lon: z.number().finite().gte(-180).lte(180),
  label: z.string().min(1),
});
export type LocationResult = z.infer<typeof locationResultSchema>;
