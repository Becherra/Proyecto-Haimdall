import { z } from "zod";
import srtmSamplesData from "../../data/samples/srtm-eje-cafetero.json";
import { terrainSampleSchema, type ClimateRecord, type Crop, type TerrainSample, type UserPriorities } from "../types";
import { EROSIVE_RAIN_REFERENCE_MM, FOURNIER_FULL_EXPOSURE, SLOPE_CAUTION_THRESHOLD_PERCENT, STEEP_SLOPE_REFERENCE_PERCENT, TEMPERATURE_LAPSE_RATE_C_PER_METER } from "./config";

const MAX_SCORE = 5;

/**
 * Muestras precargadas de altitud y pendiente para la zona piloto, validadas al importar.
 * Son lecturas del ráster NASA SRTMGL1 en cada punto piloto (ver el campo `source` y docs/srtm-samples.md): valen para el punto, no para todo el lote.
 */
export const TERRAIN_SAMPLES: readonly TerrainSample[] = z.array(terrainSampleSchema).parse(srtmSamplesData);

export type ResolvedTerrain = {
  elevationMeters?: number;
  slopePercent?: number;
  source: "srtm-sample" | "user";
};

function distanceSquared(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2;
}

/** Busca la muestra de terreno precargada más cercana que cubra las coordenadas dadas. */
export function findTerrainSample(lat: number, lon: number, samples: readonly TerrainSample[] = TERRAIN_SAMPLES): TerrainSample | null {
  const matches = samples.filter((sample) => Math.abs(lat - sample.lat) <= sample.tolerance && Math.abs(lon - sample.lon) <= sample.tolerance);
  if (matches.length === 0) return null;
  return matches.reduce((closest, candidate) => (
    distanceSquared(lat, lon, candidate.lat, candidate.lon) < distanceSquared(lat, lon, closest.lat, closest.lon) ? candidate : closest
  ));
}

/**
 * Resuelve la altitud y pendiente del lote: prioriza lo que declara el agricultor y, cuando `useSampleFallback` es verdadero,
 * completa con la muestra de terreno precargada de la zona piloto.
 */
export function resolveTerrain(
  location: { lat: number; lon: number },
  priorities?: Pick<UserPriorities, "elevationMeters" | "slopePercent">,
  useSampleFallback = false,
  samples: readonly TerrainSample[] = TERRAIN_SAMPLES,
): ResolvedTerrain | null {
  const hasUserTerrain = priorities?.elevationMeters !== undefined || priorities?.slopePercent !== undefined;
  const sample = (hasUserTerrain || useSampleFallback) ? findTerrainSample(location.lat, location.lon, samples) : null;
  if (hasUserTerrain) {
    return { elevationMeters: priorities?.elevationMeters ?? sample?.elevationMeters, slopePercent: priorities?.slopePercent ?? sample?.slopePercent, source: "user" };
  }
  return sample ? { elevationMeters: sample.elevationMeters, slopePercent: sample.slopePercent, source: "srtm-sample" } : null;
}

/**
 * Corrige la temperatura media de la celda de NASA POWER a la altitud real del lote usando el gradiente térmico
 * vertical andino (`TEMPERATURE_LAPSE_RATE_C_PER_METER`, ~0,6 °C por cada 100 m de desnivel).
 */
export function adjustTemperatureForElevation(cellMeanC: number, cellElevationMeters: number, siteElevationMeters: number): number {
  return cellMeanC + (cellElevationMeters - siteElevationMeters) * TEMPERATURE_LAPSE_RATE_C_PER_METER;
}

/**
 * Lleva las temperaturas diarias (media, mínima y máxima) de la celda de NASA POWER a la altitud del lote con el mismo
 * gradiente que la media. Así heladas, calor y evaporación potencial se calculan con la temperatura del lote y no con la de la celda.
 * Supuesto: el gradiente vertical medio también vale para las mínimas y máximas (en la práctica varía según la hora y la humedad).
 * Si falta alguna de las dos altitudes devuelve la misma serie. Los demás parámetros (lluvia, EVLAND, humedad, radiación) no se tocan.
 */
export function adjustRecordsForElevation(records: readonly ClimateRecord[], cellElevationMeters: number | undefined, siteElevationMeters: number | undefined): readonly ClimateRecord[] {
  if (cellElevationMeters === undefined || siteElevationMeters === undefined) return records;
  const shift = adjustTemperatureForElevation(0, cellElevationMeters, siteElevationMeters);
  const moved = (value: number | null) => (value === null ? null : value + shift);
  return records.map((record) => ({ ...record, T2M: moved(record.T2M), T2M_MIN: moved(record.T2M_MIN), T2M_MAX: moved(record.T2M_MAX) }));
}

/**
 * Exposición a erosión en ladera (0–1): combina qué tan empinado es el lote por encima de `SLOPE_CAUTION_THRESHOLD_PERCENT`,
 * la fuerza de la lluvia (el índice de Fournier frente a `FOURNIER_FULL_EXPOSURE` o, sin él, `extremeRainMm` frente a `EROSIVE_RAIN_REFERENCE_MM`) y la desprotección de los cultivos (`erosionReduction`).
 */
export function slopeErosionExposure(crops: readonly Crop[], slopePercent: number | undefined, extremeRainMm: number | null, fournierIndex: number | null = null): number {
  if (slopePercent === undefined || slopePercent <= SLOPE_CAUTION_THRESHOLD_PERCENT || crops.length === 0) return 0;
  const slopeSpan = STEEP_SLOPE_REFERENCE_PERCENT - SLOPE_CAUTION_THRESHOLD_PERCENT;
  const slopeShare = Math.min((slopePercent - SLOPE_CAUTION_THRESHOLD_PERCENT) / slopeSpan, 1);
  // La erosividad mensual de Fournier describe mejor la fuerza de la lluvia del sitio que un solo percentil de lluvia diaria; sin ella se usa ese percentil.
  const rainShare = fournierIndex !== null ? Math.min(fournierIndex / FOURNIER_FULL_EXPOSURE, 1) : extremeRainMm === null ? 0.5 : Math.min(extremeRainMm / EROSIVE_RAIN_REFERENCE_MM, 1);
  const averageProtection = crops.reduce((sum, crop) => sum + crop.erosionReduction, 0) / crops.length;
  const coverGap = (MAX_SCORE - averageProtection) / MAX_SCORE;
  return slopeShare * rainShare * coverGap;
}
