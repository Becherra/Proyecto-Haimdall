import type { ClimateRecord, ClimateScenario } from "../types";

const NEUTRAL_TEMP_DELTA_C = 0;
const NEUTRAL_RAIN_FACTOR = 1;
const MINUS = "−";

const tempDelta = (scenario: ClimateScenario) => scenario.tempDeltaC ?? NEUTRAL_TEMP_DELTA_C;
const rainFactor = (scenario: ClimateScenario) => scenario.rainFactor ?? NEUTRAL_RAIN_FACTOR;
const signed = (value: number, digits: number) => `${value < 0 ? MINUS : "+"}${Math.abs(value).toFixed(digits)}`;

/** ¿El escenario deja la serie igual (sin cambio de temperatura ni de lluvia)? */
export function isNeutralScenario(scenario: ClimateScenario): boolean {
  return tempDelta(scenario) === NEUTRAL_TEMP_DELTA_C && rainFactor(scenario) === NEUTRAL_RAIN_FACTOR;
}

/**
 * Aplica un escenario "¿y si…?" a la serie diaria: suma `tempDeltaC` a T2M, T2M_MIN y T2M_MAX y multiplica la lluvia por `rainFactor`.
 * El cambio es uniforme para todos los días; los datos faltantes siguen faltando y los demás parámetros
 * (EVLAND, GWETROOT, radiación) no se recalculan. Devuelve registros nuevos; no modifica los originales.
 */
export function applyScenario(records: readonly ClimateRecord[], scenario: ClimateScenario): ClimateRecord[] {
  const delta = tempDelta(scenario);
  const factor = rainFactor(scenario);
  const shift = (value: number | null) => (value === null ? null : value + delta);
  return records.map((record) => ({
    ...record, T2M: shift(record.T2M), T2M_MIN: shift(record.T2M_MIN), T2M_MAX: shift(record.T2M_MAX),
    PRECTOTCORR: record.PRECTOTCORR === null ? null : record.PRECTOTCORR * factor,
  }));
}

/** Texto del escenario, p. ej. "+2.0 °C de temperatura y −20 % de lluvia"; cadena vacía si es neutro. */
export function describeScenario(scenario: ClimateScenario): string {
  const parts: string[] = [];
  if (tempDelta(scenario) !== NEUTRAL_TEMP_DELTA_C) parts.push(`${signed(tempDelta(scenario), 1)} °C de temperatura`);
  if (rainFactor(scenario) !== NEUTRAL_RAIN_FACTOR) parts.push(`${signed((rainFactor(scenario) - NEUTRAL_RAIN_FACTOR) * 100, 0)} % de lluvia`);
  return parts.join(" y ");
}

/** Aviso que acompaña a todo resultado calculado bajo un escenario: es un supuesto, no una proyección. */
export function scenarioGap(scenario: ClimateScenario): string {
  return `Resultado bajo un escenario hipotético (${describeScenario(scenario)}) aplicado de forma uniforme a la serie histórica de NASA POWER: no es una proyección climática, y la humedad del suelo (GWETROOT) no se recalculó.`;
}
