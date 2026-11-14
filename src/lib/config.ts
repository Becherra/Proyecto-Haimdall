/** Umbral operativo para detectar noches potencialmente críticas para cultivos. */
export const FROST_THRESHOLD_C = 0;
/** Umbral alto para señalar estrés térmico en cultivos. */
export const HEAT_STRESS_THRESHOLD_C = 35;
/** Percentil alto para identificar lluvias diarias potencialmente erosivas. */
export const EXTREME_RAIN_PERCENTILE = 0.95;
/** Años mínimos con dato de un mismo mes para que su promedio histórico sirva de línea base de una anomalía. */
export const MIN_YEARS_FOR_ANOMALY_BASELINE = 2;
/** Parámetros del motor de puntuación: heurísticas de diseño, no datos NASA; validar con un agrónomo local. */
/** Déficit hídrico medio (mm/mes, evaporación − lluvia) al que el sitio se considera en sequía plena. */
export const DRYNESS_REFERENCE_MM = 100;
/** Días de estrés térmico POR AÑO (promedio de la serie) a partir de los cuales la penalización por calor es máxima: un cuarto del año. */
export const HEAT_DAYS_REFERENCE = 90;
/** Penalización máxima (en la escala 0–5) por cada riesgo climático: calor y sequía. */
export const MAX_RISK_PENALTY = 0.5;
/**
 * Penalización máxima (escala 0–5) por repetir la misma familia botánica en relevos seguidos; el monocultivo la recibe completa.
 * Heurística de diseño: refleja la recomendación general de rotar familias contra plagas y enfermedades del suelo
 * (las fichas FAO de papa y repollo piden rotaciones de 3 años o más), no una medición del lote.
 */
export const MAX_PEST_CYCLE_PENALTY = 0.5;
/** Puntaje de `nitrogenFixation` (0–5) desde el cual un cultivo cuenta como fijador de nitrógeno al armar rotaciones. */
export const NITROGEN_FIXER_THRESHOLD = 2;
/** Puntaje de atributo de cultivo (0–5) desde el cual se considera una ventaja destacada. */
export const HIGH_ATTRIBUTE_THRESHOLD = 3.5;
/** Puntaje de atributo de cultivo (0–5) por debajo del cual se considera una debilidad. */
export const LOW_ATTRIBUTE_THRESHOLD = 2;
/** Un mes es "seco" si llueve menos de esta fracción del promedio mensual del sitio (heurística de diseño, no dato NASA). */
export const SEASON_DRY_RAIN_RATIO = 0.75;
/**
 * Zona donde vale el calendario de siembra del catálogo (`sowingMonths`): caja aproximada del Eje Cafetero
 * (Caldas, Risaralda, Quindío), de donde sale la fuente. Fuera de ella el calendario no se cruza con la lluvia.
 */
export const SOWING_CALENDAR_REGION = { minLat: 3.8, maxLat: 6.0, minLon: -76.4, maxLon: -74.8 } as const;
/** Cultivo de la línea base cuando el agricultor no declara uno (decisión pendiente en CONTEXT.md §13). */
export const DEFAULT_CURRENT_CROP_ID = "maiz";
