import type { Crop, CropTemperatureRange } from "../types";
import { DEFAULT_TEMPERATURE_MARGIN_C, FROST_DAYS_REFERENCE } from "./config";

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** Aptitud lineal entre un límite (0) y el borde del rango bueno (1); 0 si la fuente da el mismo valor para ambos. */
function ramp(temperature: number, limit: number, good: number): number {
  return limit === good ? 0 : clamp((temperature - limit) / (good - limit));
}

/**
 * Aptitud térmica (0–1) de un cultivo para la temperatura media del sitio, al estilo de FAO EcoCrop:
 * 1 dentro del rango en que crece bien y baja en línea recta hasta 0 en el límite de su fuente.
 * Si la fuente no da un límite se usa `DEFAULT_TEMPERATURE_MARGIN_C`; si no da máximo del rango bueno,
 * el lado caliente no se evalúa aquí (el calor ya se penaliza con los días sobre el umbral).
 */
export function temperatureSuitability(range: CropTemperatureRange, meanTemperatureC: number): number {
  const { goodMin, goodMax } = range;
  if (meanTemperatureC < goodMin) return ramp(meanTemperatureC, range.limitMin ?? goodMin - DEFAULT_TEMPERATURE_MARGIN_C, goodMin);
  if (goodMax === undefined || meanTemperatureC <= goodMax) return 1;
  return ramp(meanTemperatureC, range.limitMax ?? goodMax + DEFAULT_TEMPERATURE_MARGIN_C, goodMax);
}

/** Desajuste térmico medio (0–1) de una rotación: promedio de (1 − aptitud); un cultivo sin rango en el catálogo cuenta como 0. */
export function temperatureMismatch(crops: readonly Crop[], meanTemperatureC: number): number {
  const total = crops.reduce((sum, crop) => sum + (crop.temperatureC ? 1 - temperatureSuitability(crop.temperatureC, meanTemperatureC) : 0), 0);
  return total / crops.length;
}

/** Cultivos de la rotación sin tolerancia a heladas documentada en el catálogo. */
export function frostUnprotected(crops: readonly Crop[]): Crop[] {
  return crops.filter((crop) => crop.frostToleranceC === undefined);
}

/** Exposición a heladas (0–1): qué tan seguido hiela (frente a `FROST_DAYS_REFERENCE` días al año) por la fracción de cultivos desprotegidos. */
export function frostExposure(crops: readonly Crop[], frostDaysPerYear: number): number {
  return Math.min(frostDaysPerYear / FROST_DAYS_REFERENCE, 1) * (frostUnprotected(crops).length / crops.length);
}

/** Rango bueno en texto: "18–30 °C", "cerca de 17 °C" o "desde 15 °C" si la fuente no da máximo. */
export function formatTemperatureRange({ goodMin, goodMax }: CropTemperatureRange): string {
  if (goodMax === undefined) return `desde ${goodMin} °C`;
  return goodMin === goodMax ? `cerca de ${goodMin} °C` : `${goodMin}–${goodMax} °C`;
}
