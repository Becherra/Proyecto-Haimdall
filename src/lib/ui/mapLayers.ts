import { z } from "zod";

export const GIBS_LAYER_IDS = ["trueColor", "ndvi"] as const;
export type GibsLayerId = (typeof GIBS_LAYER_IDS)[number];

const gibsLayerSchema = z.enum(GIBS_LAYER_IDS);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha YYYY-MM-DD");

type DateRange = { start: string; end: string };
export type GibsLayerConfig = { id: GibsLayerId; label: string; format: "jpg" | "png"; maxZoom: 9; dateRange: DateRange };

export const GIBS_LAYER_CONFIG: Record<GibsLayerId, GibsLayerConfig> = {
  trueColor: { id: "trueColor", label: "Color real MODIS Terra", format: "jpg", maxZoom: 9, dateRange: { start: "2025-11-10", end: "2026-11-14" } },
  ndvi: { id: "ndvi", label: "NDVI MODIS Terra (16 días)", format: "png", maxZoom: 9, dateRange: { start: "2026-01-01", end: "2026-10-16" } },
};

function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/** Comprueba que una fecha ISO esté dentro del intervalo documentado para la capa. */
export function isGibsDateAvailable(layerId: GibsLayerId, date: string): boolean {
  const layer = GIBS_LAYER_CONFIG[layerId];
  return isCalendarDate(date) && date >= layer.dateRange.start && date <= layer.dateRange.end;
}

/** Construye la URL RESTful WMTS de GIBS para una capa y fecha verificadas. */
export function buildGibsTileUrl(layerId: GibsLayerId, date: string): string {
  const layer = gibsLayerSchema.parse(layerId);
  dateSchema.parse(date);
  if (!isGibsDateAvailable(layer, date)) throw new Error(`NASA GIBS no tiene datos disponibles para ${date}.`);
  const config = GIBS_LAYER_CONFIG[layer];
  const identifier = layer === "trueColor" ? "MODIS_Terra_CorrectedReflectance_TrueColor" : "MODIS_Terra_L3_NDVI_16Day";
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${identifier}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.${config.format}`;
}
