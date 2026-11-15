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
/**
 * Altitud y pendiente medidas en vivo con NASA SRTM (30 m) a través de OpenTopoData, que acepta hasta 100 puntos por consulta. Parámetros de operación, no datos:
 * - `cellMeters`: separación de la malla; 30 m es la resolución nativa de SRTM.
 * - `pointGridSize`: malla de 9×9 puntos = 7×7 celdas con los ocho vecinos (~210 m), la misma ventana que usan las muestras precargadas.
 * - `polygonGridSize`: 10×10 = 100 puntos (el máximo por consulta) repartidos sobre el lote; si el lote es grande la celda crece y la pendiente sale más suavizada.
 * - `minCells`: celdas con dato mínimas para fiarse del promedio.
 * - `cacheTtlMs` y `cacheMaxEntries`: el relieve no cambia, pero el servicio público limita el uso (1 consulta por segundo, 1000 al día).
 * - `timeoutMs`: tope de espera; el análisis no debe depender de un servicio gratuito.
 */
export const LIVE_TERRAIN = { cellMeters: 30, pointGridSize: 9, polygonGridSize: 10, minCells: 3, cacheTtlMs: 7 * 24 * 60 * 60 * 1000, cacheMaxEntries: 200, timeoutMs: 5000 } as const;

/** Días por mes para pasar el ciclo de un cultivo (días) a meses de ocupación del lote en el calendario de la rotación. */
export const CALENDAR_DAYS_PER_MONTH = 30;

/** Lluvia diaria (mm) por debajo de la cual el día cuenta como seco al medir rachas secas. Convención habitual en climatología (1 mm). */
export const DRY_DAY_RAIN_MM = 1;
/** Fracción mínima de días con dato de lluvia para que un año entre en las estadísticas anuales (racha seca, peor año). */
export const MIN_YEAR_COVERAGE = 0.8;
/** Años completos mínimos para llamar "peor año" a uno de la serie; con menos, el peor año no dice nada. */
export const MIN_YEARS_FOR_WORST_YEAR = 5;
/** Meses con balance hídrico que debe tener un año para promediarlo y compararlo como "peor año". */
export const MIN_MONTHS_FOR_WORST_YEAR = 10;
/**
 * Cuánto pesa la sequía del peor año, frente a la del promedio, en la penalización por sequía:
 * 0 la ignora y 1 la trata igual que al promedio. Heurística de diseño, no un dato; validar con un agrónomo local.
 */
export const WORST_YEAR_DROUGHT_WEIGHT = 0.5;
/** Racha seca (días seguidos) desde la cual se avisa a los cultivos de baja tolerancia a sequía. Heurística de diseño; validar con un agrónomo local. */
export const DRY_SPELL_ALERT_DAYS = 20;

/**
 * Malla de NASA POWER (MERRA-2) de la que salen temperatura, lluvia, evaporación y humedad: celdas de 0,5° de latitud por 0,625° de longitud,
 * con centros en múltiplos de esos pasos. Todos los puntos de una celda reciben la misma serie (verificado contra la API), así que la caché
 * se indexa por celda y no por coordenada exacta. ALLSKY_SFC_SW_DWN usa una malla de 1° y por eso puede variar dentro de la celda; no interviene en ningún indicador.
 */
export const NASA_POWER_GRID = { latStepDegrees: 0.5, lonStepDegrees: 0.625 } as const;
/**
 * Caché en memoria de las respuestas de NASA POWER. Heurísticas de operación, no datos:
 * - `maxEntries`: una serie de 15 años pesa del orden de 1–2 MB; con 50 la memoria queda acotada aunque lleguen muchas celdas distintas.
 * - `historicalTtlMs`: la serie histórica casi no cambia, basta renovarla a diario.
 * - `recentTtlMs`: los últimos días se corrigen y se completan, se renuevan a las pocas horas.
 * - `fallbackTtlMs`: una muestra guardada solo tapa la caída de NASA; se reintenta con NASA pasado este tiempo.
 */
export const CLIMATE_CACHE = { maxEntries: 50, historicalTtlMs: 24 * 60 * 60 * 1000, recentTtlMs: 6 * 60 * 60 * 1000, fallbackTtlMs: 60 * 1000 } as const;

/** Días de NASA POWER reciente que se comparan con lo normal para describir la temporada actual. */
export const CURRENT_SEASON_DAYS = 90;
/** Años mínimos de la serie histórica con dato suficiente en la misma época para que "lo normal" sirva de comparación. */
export const MIN_YEARS_FOR_CURRENT_SEASON = 5;
/**
 * Cortes del lugar que ocupa la lluvia reciente entre los años de la serie (0 = la más seca, 1 = la más lluviosa) para decir si la temporada va
 * muy seca, seca, normal, húmeda o muy húmeda. Se mide contra la variabilidad real del sitio y no contra un porcentaje fijo: la misma lluvia puede
 * ser normal donde llueve muy distinto cada año y muy seca donde llueve parecido. Heurística de diseño; validar con un agrónomo local.
 */
export const CURRENT_SEASON_PERCENTILE = { muchDrier: 0.1, drier: 1 / 3, wetter: 2 / 3, muchWetter: 0.9 } as const;
/** Un estado "muy seca" o "muy lluviosa" pide además que la lluvia se aleje al menos este % de lo normal: ser la más seca de la serie por poco no es "casi no ha llovido". */
export const CURRENT_SEASON_MUCH_CHANGE_PERCENT = 30;

/** Desde cuántos grados de diferencia frente a lo normal la pantalla del agricultor habla de "más calor" o "menos calor". */
export const CURRENT_SEASON_TEMPERATURE_NOTICE_C = 0.5;
/** Desde cuántos días seguidos casi sin lluvia la pantalla del agricultor lo avisa. */
export const CURRENT_SEASON_DRY_STREAK_NOTICE_DAYS = 10;
/** Porcentaje de la lluvia normal con el que se llena la barra de comparación; si llovió más, la escala crece para que quepa. */
export const CURRENT_SEASON_BAR_MAX_PERCENT = 150;

/** Un mes cuenta como "de falta de agua" si, en al menos esta fracción de los años, la lluvia no cubrió lo que se pierde por evaporación: el promedio de un mes puede alcanzar y aun así faltar en 1 de cada 3 años. Heurística de diseño. */
export const WATER_SHORT_YEAR_SHARE = 1 / 3;
/** Años con dato que debe tener la serie (y cada mes) para hablar de con qué frecuencia falta agua; con menos, la frecuencia no dice nada. */
export const MIN_YEARS_FOR_WATER_SHORT_MONTHS = 5;
/**
 * Cortes del índice de humedad de la zona de raíces (GWETROOT, 0–1) para describirlo con palabras. Es un índice de un modelo de unos 50 km,
 * no un porcentaje de agua en el suelo; por eso se dice con palabras y con el índice, no como "por ciento". Heurística de diseño.
 */
export const ROOT_WETNESS_DRY_BELOW = 0.5;
export const ROOT_WETNESS_HUMID_FROM = 0.75;
/** Diferencia mínima de puntaje (escala 0–5) para decir que una opción es mejor o peor que otra; con menos se dice "igual". Heurística de diseño. */
export const SCORE_DIFFERENCE_NOTICE = 0.25;
/** Colores de la app instalada (PWA). Coinciden con `--color-meadow` de `globals.css`. */
export const PWA_THEME_COLOR = "#0d3c16";
export const PWA_BACKGROUND_COLOR = "#0d3c16";
