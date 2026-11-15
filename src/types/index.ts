import { z } from "zod";

export * from "./drought";

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
  /** Origen de los datos de terreno del lote: NASA SRTM medido en vivo ("srtm-live"), muestra precargada de NASA SRTM ("srtm-sample") o declarados por el usuario ("user"). */
  terrainSource: z.enum(["srtm-live", "srtm-sample", "user"]).optional(),
  /** Menor y mayor pendiente (%) entre las celdas medidas; solo con `terrainSource: "srtm-live"`. La pendiente varía mucho en pocos metros, el promedio no lo dice. */
  slopeRangePercent: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
  /** Lado (m) de la celda con que se midió la pendiente en vivo: 30 m en lotes chicos, más grueso en lotes grandes, donde la pendiente sale suavizada. */
  terrainCellMeters: z.number().positive().optional(),
  /** Racha más larga de días secos seguidos (lluvia menor que el umbral de día seco) en toda la serie. */
  longestDrySpellDays: z.number().int().nonnegative().optional(),
  /** Promedio, entre los años con dato suficiente, de la racha seca más larga de cada año (días). */
  meanAnnualDrySpellDays: z.number().nonnegative().nullable().optional(),
  /** Año de la serie con el balance hídrico medio mensual más bajo; ausente si la serie no tiene años completos suficientes. */
  worstYear: z.object({ year: z.number().int().min(1981), waterBalanceMm: z.number() }).optional(),
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
  /**
   * Cultivo permanente (café, plátano): ocupa el lote todo el año y no se rota. Solo se ofrece como cultivo actual del agricultor,
   * nunca como sugerencia. Sus `sowingMonths` van vacíos porque no se siembra cada año.
   */
  perennial: z.boolean().optional(),
  /** Ids de cultivos permanentes con los que este cultivo anual se puede asociar (en las calles, mientras el permanente es joven), según su fuente. */
  intercropsWith: z.array(z.string().min(1)).optional(),
});
export type Crop = z.infer<typeof cropSchema>;
export type CropTemperatureRange = NonNullable<Crop["temperatureC"]>;

export const rotationSchema = z.object({ id: z.string().min(1), name: z.string().min(1), cropIds: z.array(z.string().min(1)).min(1), description: z.string().min(1) });
export type Rotation = z.infer<typeof rotationSchema>;

export const userPrioritiesSchema = z.object({
  waterSaving: score, extraIncome: score, soilImprovement: score, erosionReduction: score, lowRisk: score,
  currentCropId: z.string().min(1).optional(),
  /** El agricultor declara que hoy no tiene cultivo: el análisis no compara contra uno actual (ignora `currentCropId`) y propone tres puntos de partida. */
  noCurrentCrop: z.boolean().optional(),
  waterAvailability: z.enum(["low", "medium", "high"]).optional(),
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
    // Manual area entry is exact and intentionally has no selected estimate bucket.
    areaRangeHa: z.tuple([z.number().finite().positive(), z.number().finite().positive()])
      .refine(([minimum, maximum]) => minimum < maximum, "El rango de área debe crecer").optional(),
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

/** Un mes del calendario estimado de una rotación: qué cultivo ocupa el lote (null = campo vacío) y si el mes es vulnerable. */
export const rotationCalendarMonthSchema = z.object({
  /** Meses transcurridos desde la primera siembra de la rotación (0 = mes de la primera siembra). */
  offset: z.number().int().nonnegative(), month: z.number().int().min(1).max(12),
  cropId: z.string().min(1).nullable(),
  /** Mes seco según la estacionalidad del sitio; null si no hubo dato de lluvia para ese mes. */
  dry: z.boolean().nullable(),
  /** "water-stress": cultivo poco tolerante a sequía en mes seco; "bare-soil-rain": campo vacío en mes lluvioso (erosión). */
  risk: z.enum(["water-stress", "bare-soil-rain"]).nullable(),
});
export type RotationCalendarMonth = z.infer<typeof rotationCalendarMonthSchema>;

/** Calendario ilustrativo de un ciclo completo de la rotación, armado con los meses de siembra y ciclos típicos del catálogo. */
export const rotationCalendarSchema = z.object({
  months: z.array(rotationCalendarMonthSchema).min(1),
  fallowMonths: z.number().int().nonnegative(), vulnerableMonths: z.number().int().nonnegative(),
});
export type RotationCalendar = z.infer<typeof rotationCalendarSchema>;

/** Versión en lenguaje simple de los textos de una rotación, pensada para quien lee poco; los campos técnicos de `RotationResult` se conservan. */
export const rotationPlainSchema = z.object({
  why: z.string().min(1), benefits: z.array(z.string().min(1)).min(1), risks: z.array(z.string().min(1)).min(1),
  gaps: z.array(z.string().min(1)).min(1), validate: z.array(z.string().min(1)).min(1),
});
export type RotationPlain = z.infer<typeof rotationPlainSchema>;

/**
 * Origen de un dato que respalda una acción: medición ("observed"), estimación modelada ("estimated"), lo que declaró el agricultor
 * ("declared"), dato regional que no es del lote, p. ej. NASA POWER ("regional"), o práctica técnica publicada ("published-practice").
 */
export const evidenceTypeSchema = z.enum(["observed", "estimated", "declared", "regional", "published-practice"]);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

/** Un dato o publicación que respalda una acción del plan, con su fuente, escala y fecha para que se pueda rastrear. */
export const evidenceSchema = z.object({
  id: z.string().min(1), type: evidenceTypeSchema, source: z.string().min(1), sourceUrl: z.string().url().optional(),
  /** Resolución o escala del dato (p. ej. "malla de ~0.5°", "250 m"); ausente si no aplica o no se conoce. */
  scale: z.string().min(1).optional(), date: z.string().min(1).optional(),
  /** Qué dice el dato en este caso, en una frase. */
  detail: z.string().min(1),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const PLAN_STAGES = ["understand", "prepare", "monitor", "review"] as const;
/** Etapas del plan: entender la finca, preparar el cambio, hacer seguimiento y revisar antes de continuar. */
export const planStageSchema = z.enum(PLAN_STAGES);
export type PlanStage = z.infer<typeof planStageSchema>;

/** "ready": hay datos y fuente; "missing-data": falta un dato de la finca; "insufficient-evidence": no hay respaldo documentado. */
export const planActionStatusSchema = z.enum(["ready", "missing-data", "insufficient-evidence"]);
export type PlanActionStatus = z.infer<typeof planActionStatusSchema>;

/** Una acción del plan: solo es "ready" si trae evidencia y ningún dato pendiente; si no, dice qué falta en vez de dar una instrucción. */
export const planActionSchema = z.object({
  id: z.string().min(1), stage: planStageSchema, status: planActionStatusSchema,
  what: z.string().min(1), why: z.string().min(1),
  /** Cuándo aplica: etapa del cultivo o ventana regional documentada, no un mes genérico. */
  appliesWhen: z.string().min(1),
  prerequisites: z.array(z.string().min(1)), missingData: z.array(z.string().min(1)),
  /** Cómo comprobar o registrar el resultado. */
  verification: z.string().min(1), evidence: z.array(evidenceSchema),
}).superRefine((action, ctx) => {
  if (action.status === "ready" && action.evidence.length === 0) ctx.addIssue({ code: "custom", path: ["evidence"], message: "Una acción lista necesita evidencia" });
  if (action.status === "ready" && action.missingData.length > 0) ctx.addIssue({ code: "custom", path: ["missingData"], message: "Una acción lista no puede tener datos pendientes" });
  if (action.status !== "ready" && action.missingData.length === 0) ctx.addIssue({ code: "custom", path: ["missingData"], message: "Indica qué dato falta" });
});
export type PlanAction = z.infer<typeof planActionSchema>;

export const planStageGroupSchema = z.object({ stage: planStageSchema, actions: z.array(planActionSchema) });
export type PlanStageGroup = z.infer<typeof planStageGroupSchema>;

/**
 * Plan orientativo de transición hacia una rotación, armado con reglas documentadas. "insufficient" significa que no hay respaldo
 * para este cultivo o zona: no puede traer acciones listas y debe explicar sus vacíos.
 */
export const actionPlanSchema = z.object({
  status: z.enum(["ready", "partial", "insufficient"]), stages: z.array(planStageGroupSchema),
  gaps: z.array(z.string().min(1)), disclaimer: z.string().min(1),
}).superRefine((plan, ctx) => {
  const seen = new Set<string>();
  plan.stages.forEach((group, index) => {
    if (seen.has(group.stage)) ctx.addIssue({ code: "custom", path: ["stages", index, "stage"], message: "Etapa repetida" });
    seen.add(group.stage);
    if (group.actions.some((action) => action.stage !== group.stage)) ctx.addIssue({ code: "custom", path: ["stages", index, "actions"], message: "Hay acciones en una etapa distinta a la de su grupo" });
  });
  if (plan.status === "insufficient" && plan.stages.some((group) => group.actions.some((action) => action.status === "ready"))) {
    ctx.addIssue({ code: "custom", path: ["stages"], message: "Un plan con información insuficiente no puede traer acciones listas" });
  }
  if (plan.status === "insufficient" && plan.gaps.length === 0) ctx.addIssue({ code: "custom", path: ["gaps"], message: "Explica los vacíos de información" });
});
export type ActionPlan = z.infer<typeof actionPlanSchema>;

export const rotationResultSchema = z.object({
  rotation: rotationSchema, score: z.number(), whySuggested: z.string().min(1), evidence: z.array(z.string().min(1)).min(1),
  benefits: z.array(z.string().min(1)).min(1), informationGaps: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string().min(1)).min(1), validateWithLocalExpert: z.array(z.string().min(1)).min(1),
  /** Ausente cuando no aplica el calendario de siembra del catálogo (fuera del Eje Cafetero) o no se pudo armar. */
  calendar: rotationCalendarSchema.optional(),
  /** Mismos temas en palabras simples (sin cifras técnicas). Ausente en respuestas antiguas: la interfaz usa entonces los textos técnicos. */
  plain: rotationPlainSchema.optional(),
  /** Plan orientativo para pasar de la finca actual a esta alternativa; ausente hasta que el backend lo genere. */
  actionPlan: actionPlanSchema.optional(),
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

/**
 * Escenario hipotético "¿y si…?" aplicado de forma uniforme a la serie histórica de NASA POWER; no es una proyección climática.
 * Los límites evitan escenarios fuera de lo razonable para una comparación rápida.
 */
export const climateScenarioSchema = z.object({
  /** Grados que se suman a la temperatura media, mínima y máxima de cada día (°C). Ausente = 0. */
  tempDeltaC: z.number().finite().min(-2).max(5).optional(),
  /** Factor que multiplica la lluvia de cada día (0.8 = 20 % menos lluvia). Ausente = 1. */
  rainFactor: z.number().finite().min(0.5).max(1.5).optional(),
});
export type ClimateScenario = z.infer<typeof climateScenarioSchema>;

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
  scenario: climateScenarioSchema.optional(),
  /** Pide incluir los registros diarios en `climate.records` (miles de filas). Por defecto no se envían. */
  includeDailyRecords: z.boolean().optional(),
}).refine((value) => value.startYear <= value.endYear, "startYear debe ser menor o igual que endYear");
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

/**
 * Clima dentro de la respuesta de análisis: el resumen de la serie y, solo si se pidieron, los registros diarios.
 * `daysAnalyzed`, `firstDate` y `lastDate` son opcionales para no romper consumidores previos; `buildAnalysis` siempre los entrega.
 */
export const analysisClimateSchema = climateResultSchema.omit({ records: true }).extend({
  records: z.array(climateRecordSchema).optional(),
  daysAnalyzed: z.number().int().nonnegative().optional(),
  firstDate: z.string().regex(/^\d{8}$/).optional(), lastDate: z.string().regex(/^\d{8}$/).optional(),
});
export type AnalysisClimate = z.infer<typeof analysisClimateSchema>;

/** Un dato usado en el análisis, con su proveedor y para qué se usó (trazabilidad de cada número mostrado). */
export const dataSourceSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), provider: z.string().min(1), use: z.string().min(1), url: z.string().url().optional(),
});
export type DataSource = z.infer<typeof dataSourceSchema>;

/** Cómo va la lluvia de la temporada actual frente a lo normal de esa misma época. */
export const currentSeasonStatusSchema = z.enum(["much-drier", "drier", "normal", "wetter", "much-wetter"]);
export type CurrentSeasonStatus = z.infer<typeof currentSeasonStatusSchema>;

/**
 * Los últimos días de NASA POWER comparados con el mismo tramo del calendario en la serie histórica.
 * Es una lectura reciente y preliminar (NASA corrige datos recientes), no un pronóstico.
 */
export const currentSeasonSchema = z.object({
  /** Días que abarca la ventana pedida (hasta `lastDate`). */
  windowDays: z.number().int().positive(),
  firstDate: z.string().regex(/^\d{8}$/), lastDate: z.string().regex(/^\d{8}$/),
  /** Días de la ventana con dato de lluvia. */
  daysWithData: z.number().int().positive(),
  rainMm: z.number().nonnegative(), normalRainMm: z.number().nonnegative(),
  /** Lluvia de la ventana como porcentaje de la normal; null si la normal es 0. */
  rainPercentOfNormal: z.number().nonnegative().nullable(),
  status: currentSeasonStatusSchema,
  /** Diferencia de temperatura media frente a lo normal (°C); null si falta dato. */
  temperatureAnomalyC: z.number().nullable(),
  /** Días secos seguidos hasta `lastDate`. */
  currentDryStreakDays: z.number().int().nonnegative(),
  /** Años de la serie histórica con dato suficiente en esa misma época. */
  baselineYears: z.number().int().positive(),
});
export type CurrentSeason = z.infer<typeof currentSeasonSchema>;

export const analysisResponseSchema = z.object({
  climate: analysisClimateSchema, monthlyClimate: z.array(monthlyClimateSchema), indicators: indicatorsSchema, rotations: z.array(rotationResultSchema).min(3),
  /** Escenario aplicado, si se pidió: `monthlyClimate`, `indicators` y `rotations` lo reflejan; `climate` conserva los datos originales de NASA. */
  scenario: climateScenarioSchema.optional(),
  /** Datos usados en este análisis y para qué. Opcional para no romper consumidores previos; `buildAnalysis` siempre lo entrega. */
  dataSources: z.array(dataSourceSchema).optional(),
  /** Temporada actual frente a lo normal; ausente si no se pudo consultar NASA POWER reciente o no hay línea base. */
  currentSeason: currentSeasonSchema.optional(),
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

export * from "./cropProfile";
