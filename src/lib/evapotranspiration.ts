/**
 * Evaporación potencial (ET0) con la ecuación de Hargreaves–Samani, FAO-56 (Allen et al., 1998, ec. 52).
 * Solo necesita temperatura y latitud, así que se puede calcular con datos de NASA POWER en cualquier punto del mundo.
 * Es una estimación (error típico de decenas de %), no una medición: por eso el resultado se rotula como estimado.
 */

/** Constante solar, MJ m⁻² min⁻¹ (FAO-56). */
const SOLAR_CONSTANT = 0.082;
/** 1 MJ m⁻² día⁻¹ equivale a 0.408 mm/día de agua evaporada (FAO-56). */
const MJ_TO_MM_WATER = 0.408;
/** Coeficientes empíricos de Hargreaves–Samani (FAO-56, ec. 52). */
const HARGREAVES_COEFFICIENT = 0.0023;
const HARGREAVES_TEMPERATURE_OFFSET_C = 17.8;
const MINUTES_PER_DAY = 24 * 60;

/** Día del año (1–366) de una fecha "YYYYMMDD" de NASA POWER. */
export function dayOfYear(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}

/**
 * Radiación extraterrestre Ra (MJ m⁻² día⁻¹) a una latitud (grados, sur negativo) y día del año; FAO-56 ec. 21.
 * Con sol de medianoche o noche polar el ángulo horario se acota, así que devuelve el máximo o 0 sin fallar.
 */
export function extraterrestrialRadiation(latitudeDegrees: number, day: number): number {
  const latitude = (latitudeDegrees * Math.PI) / 180;
  const yearAngle = (2 * Math.PI * day) / 365;
  const inverseDistance = 1 + 0.033 * Math.cos(yearAngle);
  const declination = 0.409 * Math.sin(yearAngle - 1.39);
  const sunsetArgument = Math.min(Math.max(-Math.tan(latitude) * Math.tan(declination), -1), 1);
  const sunsetAngle = Math.acos(sunsetArgument);
  const radiation = ((MINUTES_PER_DAY / Math.PI) * SOLAR_CONSTANT * inverseDistance)
    * (sunsetAngle * Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.sin(sunsetAngle));
  return Math.max(radiation, 0);
}

/** Evaporación potencial diaria (mm/día) de Hargreaves–Samani a partir de T media, mínima, máxima (°C) y Ra (MJ m⁻² día⁻¹). */
export function hargreavesDailyPet(meanC: number, minC: number, maxC: number, radiationMj: number): number {
  const range = Math.sqrt(Math.max(maxC - minC, 0));
  const pet = HARGREAVES_COEFFICIENT * (meanC + HARGREAVES_TEMPERATURE_OFFSET_C) * range * MJ_TO_MM_WATER * radiationMj;
  return Math.max(pet, 0);
}
