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
  /** Evaporación potencial estimada del mes (mm). Ausente si no se calculó (no se conocía la latitud); null si faltaron datos. */
  potentialEvaporationMm: z.number().nullable().optional(),
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
  /** Con qué se calculó `waterDeficitMm`: evaporación potencial estimada ("potential") o EVLAND de NASA ("evland", la real, que subestima la aridez). */
  waterBalanceMethod: z.enum(["potential", "evland"]).optional(),
  /** Temperatura media estimada para el sitio (°C); si se conocen las altitudes de la celda y del lote se corrige por piso térmico, si no es el promedio de T2M de la celda. */
  meanTemperatureC: z.number().nullable().optional(),
  /** Temperatura media sin corregir de la celda de NASA POWER (T2M, °C) cuando se aplicó corrección por altitud. */
  cellMeanTemperatureC: z.number().nullable().optional(),
  /** Altitud media de la celda de NASA POWER (m s. n. m.). */
  cellElevationMeters: z.number().finite().optional(),
  /** Altitud del lote (m s. n. m., SRTM o declarada) con la que se ajustó la temperatura. */
  siteElevationMeters: z.number().finite().optional(),
  /** Pendiente media del lote (%, SRTM o declarada) para evaluar erosión en ladera. */
  slopePercent: z.number().finite().min(0).max(100).optional(),
  /** Origen de los datos de terreno del lote: muestra precargada de NASA SRTM ("srtm-sample") o declarados por el usuario ("user"). */
  terrainSource: z.enum(["srtm-sample", "user"]).optional(),
});
export type Indicators = z.infer<typeof indicatorsSchema>;

export const cropSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), waterUse: score, nitrogenFixation: score, erosionReduction: score,
  organicMatter: score, forageValue: score, marketPotential: score, heatTolerance: score, droughtTolerance: score,
  cycleDays: z.number().int().positive(), sowingMonths: z.array(z.number().int().min(1).max(12)), source: z.string().min(1),
  /** Familia botánica en español (p. ej. "Leguminosas"). Opcional para no romper catálogos previos; sin ella no se evalúa si la rotación alterna familias. */
  family: z.string().min(1).optional(),
  /**
   * Temperatura media diaria (°C) según la fuente del cultivo: entre `goodMin` y `goodMax` crece bien; fuera de `limitMin`–`limitMax` no produce.
   * Solo `goodMin` es obligatorio: un extremo ausente significa que la fuente no lo da. Sin este campo no se evalúa la aptitud térmica.
   */
  temperatureC: z.object({ goodMin: z.number(), goodMax: z.number().optional(), limitMin: z.number().optional(), limitMax: z.number().optional() }).optional(),
  /** Helada corta más fría (°C) que el cultivo soporta según su fuente. Ausente = sin tolerancia documentada. */
  frostToleranceC: z.number().optional(),
});
export type Crop = z.infer<typeof cropSchema>;
export type CropTemperatureRange = NonNullable<Crop["temperatureC"]>;

export const rotationSchema = z.object({ id: z.string().min(1), name: z.string().min(1), cropIds: z.array(z.string().min(1)).min(1), description: z.string().min(1) });
export type Rotation = z.infer<typeof rotationSchema>;

export const userPrioritiesSchema = z.object({
  waterSaving: score, extraIncome: score, soilImprovement: score, erosionReduction: score, lowRisk: score,
  currentCropId: z.string().min(1).optional(), waterAvailability: z.enum(["low", "medium", "high"]).optional(),
  /** Altitud del lote declarada por el agricultor (m s. n. m.); permite corregir la temperatura de la celda de NASA POWER. */
  elevationMeters: z.number().finite().min(-500).max(6000).optional(),
  /** Pendiente media del lote declarada por el agricultor (%, 0–100); pondera el riesgo de erosión en ladera. */
  slopePercent: z.number().finite().min(0).max(100).optional(),
});
export type UserPriorities = z.infer<typeof userPrioritiesSchema>;

export const terrainSampleSchema = z.object({
  id: z.string().min(1), name: z.string().min(1),
  lat: z.number().finite().gte(-90).lte(90), lon: z.number().finite().gte(-180).lte(180), tolerance: z.number().positive(),
  elevationMeters: z.number().finite().min(-500).max(6000), slopePercent: z.number().finite().min(0).max(100), source: z.string().min(1),
});
export type TerrainSample = z.infer<typeof terrainSampleSchema>;

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
  /** Elevación media de la celda de NASA POWER (m s. n. m., geometry.coordinates[2]); ausente si la respuesta no la incluye. */
  cellElevationMeters: z.number().finite().optional(),
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
