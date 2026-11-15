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
/**
 * Penalización máxima (escala 0–5) cuando la temperatura media del sitio queda fuera del límite de todos los cultivos de la rotación.
 * Es alta a propósito: un cultivo que no se da en ese clima no debe salir sugerido por sus otros atributos. Heurística de diseño.
 */
export const MAX_TEMPERATURE_PENALTY = 2;
/**
 * Grados entre el rango en que un cultivo crece bien y su límite cuando la fuente no da el límite.
 * Es la mediana aproximada de los márgenes que sí traen las fuentes del catálogo (3 a 10 °C); heurística, no dato.
 */
export const DEFAULT_TEMPERATURE_MARGIN_C = 7;
/** Días de helada POR AÑO a partir de los cuales la penalización por heladas es máxima: un mes al año. Heurística de diseño. */
export const FROST_DAYS_REFERENCE = 30;
/** Penalización máxima (escala 0–5) por heladas frecuentes en una rotación sin tolerancia documentada. */
export const MAX_FROST_PENALTY = 1;
/** Cuánto pesan la sequía y la siembra en meses secos según el agua que el agricultor dice tener (riego, nacimiento, reservorio). Heurística de diseño. */
export const WATER_AVAILABILITY_DROUGHT_FACTOR = { low: 1.5, medium: 1, high: 0.5 } as const;
/** Penalización máxima (escala 0–5) a un cultivo de máximo consumo de agua cuando el agricultor declara poca agua disponible. */
export const MAX_WATER_SCARCITY_PENALTY = 0.5;
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
/** Gradiente térmico vertical andino (°C por metro de altitud): ~0,6 °C menos por cada 100 m que se sube (IDEAM / Cenicafé). */
export const TEMPERATURE_LAPSE_RATE_C_PER_METER = 0.006;
/** Pendiente del terreno (%) desde la cual el lote se considera en ladera con riesgo relevante de escorrentía y erosión. */
export const SLOPE_CAUTION_THRESHOLD_PERCENT = 15;
/** Pendiente de referencia (%) a partir de la cual la exposición a erosión en ladera alcanza el máximo (1). Heurística de diseño. */
export const STEEP_SLOPE_REFERENCE_PERCENT = 30;
/** Lluvia diaria extrema (percentil 95, mm/día) de referencia para escalar la fuerza erosiva de los aguaceros en ladera. */
export const EROSIVE_RAIN_REFERENCE_MM = 25;
/** Penalización máxima (escala 0–5) para una rotación sin cobertura en una ladera empinada con aguaceros fuertes. */
export const MAX_SLOPE_EROSION_PENALTY = 0.75;

/** Días por mes para pasar el ciclo de un cultivo (días) a meses de ocupación del lote en el calendario de la rotación. */
export const CALENDAR_DAYS_PER_MONTH = 30;
