import type { ClimateParameter, DataSource, Indicators } from "../types";

const POWER_PROVIDER = "NASA POWER";
const POWER_URL = "https://power.larc.nasa.gov/";
const SRTM_URL = "https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl1-003";

type ParameterUse = { label: string; use: (indicators: Indicators) => string };

/** Para qué usa el análisis cada parámetro diario de NASA POWER. Si un dato no interviene en el puntaje, se dice. */
const POWER_PARAMETERS: Record<ClimateParameter, ParameterUse> = {
  T2M: { label: "Temperatura media a 2 m", use: () => "Temperatura media del sitio, aptitud térmica de cada cultivo y evaporación potencial." },
  T2M_MIN: { label: "Temperatura mínima a 2 m", use: () => "Días con riesgo de helada y evaporación potencial." },
  T2M_MAX: { label: "Temperatura máxima a 2 m", use: () => "Días de estrés por calor y evaporación potencial." },
  PRECTOTCORR: { label: "Precipitación corregida", use: () => "Balance hídrico, meses secos y lluviosos, meses de siembra del sitio, umbral de lluvia extrema y erosividad de la lluvia." },
  EVLAND: {
    label: "Evaporación terrestre",
    use: ({ waterBalanceMethod }) => (waterBalanceMethod === "potential"
      ? "Resumen mensual de evaporación; el balance hídrico usa en su lugar la evaporación potencial estimada con Hargreaves–Samani."
      : "Balance hídrico (lluvia − evaporación)."),
  },
  GWETROOT: { label: "Humedad de la zona de raíces", use: () => "Humedad media del suelo; se muestra como evidencia y no cambia el puntaje." },
  ALLSKY_SFC_SW_DWN: { label: "Radiación solar en superficie", use: () => "Luz que llega al sitio y nubosidad (índice de claridad); se muestra como evidencia y no cambia el puntaje." },
};

function powerSources(indicators: Indicators): DataSource[] {
  return (Object.entries(POWER_PARAMETERS) as Array<[ClimateParameter, ParameterUse]>).map(([parameter, { label, use }]) => ({
    id: `power-${parameter.toLowerCase()}`, name: `${label} (${parameter})`, provider: POWER_PROVIDER, use: use(indicators), url: POWER_URL,
  }));
}

function terrainSources({ cellElevationMeters, siteElevationMeters, slopePercent, terrainSource }: Indicators): DataSource[] {
  const sources: DataSource[] = [];
  const hasSiteTerrain = siteElevationMeters !== undefined || slopePercent !== undefined;
  if (cellElevationMeters !== undefined && siteElevationMeters !== undefined) {
    sources.push({ id: "power-cell-elevation", name: "Altitud media de la celda", provider: POWER_PROVIDER, use: "Corregir la temperatura de la celda a la altitud del lote.", url: POWER_URL });
  }
  if (hasSiteTerrain && terrainSource === "srtm-live") {
    sources.push({ id: "terrain-srtm-live", name: "Altitud y pendiente del lote (medidas en vivo)", provider: "NASA SRTMGL1 versión 003 (NASA/USGS, LP DAAC), consultado vía OpenTopoData", use: "Ajuste de temperatura por altitud y riesgo de erosión en ladera.", url: SRTM_URL });
  }
  if (hasSiteTerrain && terrainSource === "srtm-sample") {
    sources.push({ id: "terrain-srtm", name: "Altitud y pendiente del punto piloto más cercano", provider: "NASA SRTMGL1 versión 003 (NASA/USGS, LP DAAC)", use: "Ajuste de temperatura por altitud y riesgo de erosión en ladera.", url: SRTM_URL });
  }
  if (hasSiteTerrain && terrainSource === "user") {
    sources.push({ id: "terrain-user", name: "Altitud y pendiente del lote", provider: "Declarado por el agricultor", use: "Ajuste de temperatura por altitud y riesgo de erosión en ladera." });
  }
  return sources;
}

/**
 * Lista los datos que alimentan un análisis y para qué se usó cada uno, para que todo número mostrado se pueda rastrear
 * a un dato de NASA POWER, al catálogo de cultivos o a lo que declaró el agricultor.
 */
export function listDataSources(indicators: Indicators, { currentSeason = false }: { currentSeason?: boolean } = {}): DataSource[] {
  return [
    ...powerSources(indicators),
    ...(currentSeason ? [{ id: "power-recent", name: "Clima de los últimos días", provider: POWER_PROVIDER, use: "Comparar la lluvia de la temporada actual con lo normal de esa misma época (lectura reciente y preliminar, no un pronóstico).", url: POWER_URL }] : []),
    ...terrainSources(indicators),
    {
      id: "crops-catalog", name: "Catálogo de cultivos (data/crops.json)", provider: "Equipo Heimdall, con fuente por cultivo en docs/crops-rubric.md",
      use: "Atributos 0–5, ciclos, meses de siembra y rangos de temperatura de cada cultivo; son puntajes preliminares sin validar por un agrónomo.",
    },
  ];
}
