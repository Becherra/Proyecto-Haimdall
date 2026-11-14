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
/** Días de estrés térmico en la serie a partir de los cuales la penalización por calor es máxima. */
export const HEAT_DAYS_REFERENCE = 30;
/** Penalización máxima (en la escala 0–5) por cada riesgo climático: calor y sequía. */
export const MAX_RISK_PENALTY = 0.5;
/** Puntaje de atributo de cultivo (0–5) desde el cual se considera una ventaja destacada. */
export const HIGH_ATTRIBUTE_THRESHOLD = 3.5;
/** Puntaje de atributo de cultivo (0–5) por debajo del cual se considera una debilidad. */
export const LOW_ATTRIBUTE_THRESHOLD = 2;
