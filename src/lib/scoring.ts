import type { Crop, Indicators, Rotation, RotationCalendar, RotationResult, UserPriorities } from "../types";
import { buildRotationCalendar, calendarEvidence, calendarGap, calendarRisks } from "./calendar";
import {
  SEASON_DRY_RAIN_RATIO, DRYNESS_REFERENCE_MM, DRY_DAY_RAIN_MM, DRY_SPELL_ALERT_DAYS, MIN_YEARS_FOR_WORST_YEAR, WORST_YEAR_DROUGHT_WEIGHT, FROST_THRESHOLD_C, HEAT_DAYS_REFERENCE, HEAT_STRESS_THRESHOLD_C, HIGH_ATTRIBUTE_THRESHOLD, LOW_ATTRIBUTE_THRESHOLD, MAX_FROST_PENALTY,
  MAX_PEST_CYCLE_PENALTY, MAX_RISK_PENALTY, MAX_SLOPE_EROSION_PENALTY, MAX_TEMPERATURE_PENALTY, MAX_WATER_SCARCITY_PENALTY, SLOPE_CAUTION_THRESHOLD_PERCENT, WATER_AVAILABILITY_DROUGHT_FACTOR,
} from "./config";
import { formatTemperatureRange, frostExposure, frostUnprotected, temperatureMismatch, temperatureSuitability } from "./climateFit";
import { commonName, familyBreakShare } from "./rotations";
import { assessSowing, formatMonths, type MonthSeason, type SowingAssessment } from "./seasonality";
import { buildPlain, type PenaltyKind } from "./plainText";
import { slopeErosionExposure } from "./terrain";

type CriterionKey = "waterSaving" | "extraIncome" | "soilImprovement" | "erosionReduction" | "lowRisk";
type Criterion = { key: CriterionKey; label: string; weight: number; value: number };
type Penalty = { label: string; value: number; kind: PenaltyKind };
type SowingFinding = { crop: Crop; assessment: SowingAssessment };
/** `familyBreak`: fracción de relevos que cambian de familia botánica (ver `familyBreakShare`); null si el catálogo no trae las familias. */
type Evaluation = { rotation: Rotation; crops: Crop[]; score: number; criteria: Criterion[]; penalties: Penalty[]; sowing: SowingFinding[] | null; calendar: RotationCalendar | null; years: number; familyBreak: number | null; waterAvailability: WaterAvailability | undefined };
type WaterAvailability = NonNullable<UserPriorities["waterAvailability"]>;

/**
 * Entrada del motor: todo llega como dato, sin leer archivos ni red.
 * `seasonality` (opcional) permite cruzar los meses de siembra con las épocas secas del sitio.
 * `yearsAnalyzed` (opcional, por defecto 1) son los años que cubren los conteos de días de `indicators`, para pasarlos a días por año.
 */
export type ScoringInput = { rotations: readonly Rotation[]; crops: readonly Crop[]; indicators: Indicators; priorities: UserPriorities; seasonality?: readonly MonthSeason[]; yearsAnalyzed?: number };
type Context = Omit<ScoringInput, "rotations" | "yearsAnalyzed"> & { years: number };

const LABELS: Record<CriterionKey, string> = {
  waterSaving: "Ahorro de agua", extraIncome: "Ingresos extra", soilImprovement: "Mejora del suelo", erosionReduction: "Reducción de erosión", lowRisk: "Bajo riesgo",
};
const CRITERIA = Object.keys(LABELS) as CriterionKey[];
const MAX_SCORE = 5;

function average(crops: readonly Crop[], pick: (crop: Crop) => number): number {
  return crops.reduce((total, crop) => total + pick(crop), 0) / crops.length;
}

function resolveCrops(rotation: Rotation, catalog: readonly Crop[]): Crop[] {
  if (rotation.cropIds.length === 0) throw new Error(`La rotación "${rotation.id}" no tiene cultivos`);
  return rotation.cropIds.map((id) => {
    const crop = catalog.find((candidate) => candidate.id === id);
    if (!crop) throw new Error(`El cultivo "${id}" no existe en el catálogo (rotación "${rotation.id}")`);
    return crop;
  });
}

/**
 * Qué tan seco es el sitio, de 0 a 1: déficit hídrico medio (evaporación − lluvia, mm/mes)
 * dividido por `DRYNESS_REFERENCE_MM`. Balance positivo o sin dato cuenta como 0.
 */
export function drynessFactor(indicators: Indicators): number {
  return drynessOfBalance(indicators.waterDeficitMm);
}

function drynessOfBalance(balance: number | null | undefined): number {
  if (balance === null || balance === undefined || balance >= 0) return 0;
  return Math.min(-balance / DRYNESS_REFERENCE_MM, 1);
}

/** Qué tan seco fue el peor año de la serie (0–1, misma escala que `drynessFactor`); 0 si la serie no permite identificarlo. */
function worstYearDryness({ worstYear }: Indicators): number {
  return drynessOfBalance(worstYear?.waterBalanceMm);
}

/** Pesos de las prioridades normalizados para sumar 1; con todas en 0 se reparten por igual. */
function normalizedWeights(priorities: UserPriorities): Record<CriterionKey, number> {
  const total = CRITERIA.reduce((sum, key) => sum + priorities[key], 0);
  return Object.fromEntries(CRITERIA.map((key) => [key, total === 0 ? 1 / CRITERIA.length : priorities[key] / total])) as Record<CriterionKey, number>;
}

/** Puntaje 0–5 de cada criterio; el agua mezcla bajo uso de agua con tolerancia a sequía a medida que el sitio se seca. */
function criterionValues(crops: readonly Crop[], dryness: number): Record<CriterionKey, number> {
  const waterBase = average(crops, (crop) => MAX_SCORE - crop.waterUse);
  const drought = average(crops, (crop) => crop.droughtTolerance);
  return {
    waterSaving: (1 - dryness) * waterBase + (dryness * (waterBase + drought)) / 2,
    extraIncome: average(crops, (crop) => crop.marketPotential),
    soilImprovement: average(crops, (crop) => (crop.nitrogenFixation + crop.organicMatter) / 2),
    erosionReduction: average(crops, (crop) => crop.erosionReduction),
    lowRisk: average(crops, (crop) => (crop.heatTolerance + crop.droughtTolerance + crop.marketPotential) / 3),
  };
}

/** Días por año de una cuenta que abarca toda la serie. */
const perYear = (days: number, years: number) => days / years;

/** `waterFactor` escala la sequía según el agua que el agricultor declara tener (`WATER_AVAILABILITY_DROUGHT_FACTOR`). */
function riskPenalties(crops: readonly Crop[], indicators: Indicators, dryness: number, years: number, waterFactor: number): Penalty[] {
  const heatPerYear = perYear(indicators.heatStressDays, years);
  const heatShare = Math.min(heatPerYear / HEAT_DAYS_REFERENCE, 1);
  const heatGap = (MAX_SCORE - average(crops, (crop) => crop.heatTolerance)) / MAX_SCORE;
  const droughtGap = (MAX_SCORE - average(crops, (crop) => crop.droughtTolerance)) / MAX_SCORE;
  const penalties: Penalty[] = [
    { kind: "heat", label: `calor (≈${heatPerYear.toFixed(0)} días al año sobre ${HEAT_STRESS_THRESHOLD_C} °C)`, value: heatShare * heatGap * MAX_RISK_PENALTY },
    { kind: "drought", label: "sequía (balance hídrico negativo)", value: dryness * droughtGap * MAX_RISK_PENALTY * waterFactor },
    // Solo lo que el peor año agrega a la sequía del promedio, para no contarla dos veces.
    { kind: "drought", label: `sequía en años malos (año más seco: ${indicators.worstYear?.year}, balance ${oneDecimal(indicators.worstYear?.waterBalanceMm ?? 0)} mm/mes)`, value: Math.max(worstYearDryness(indicators) - dryness, 0) * droughtGap * MAX_RISK_PENALTY * WORST_YEAR_DROUGHT_WEIGHT * waterFactor },
  ];
  return penalties.filter((penalty) => penalty.value > 0);
}

function dryShare({ dryMonths, wetMonths }: SowingAssessment): number {
  const known = dryMonths.length + wetMonths.length;
  return known === 0 ? 0 : dryMonths.length / known;
}

/** Castiga sembrar en meses secos solo a los cultivos que toleran poco la sequía; promedia entre los cultivos de la rotación. */
function sowingPenalties(sowing: SowingFinding[] | null): Penalty[] {
  if (!sowing) return [];
  const gap = ({ crop }: SowingFinding) => (MAX_SCORE - crop.droughtTolerance) / MAX_SCORE;
  const value = sowing.reduce((total, finding) => total + dryShare(finding.assessment) * gap(finding) * MAX_RISK_PENALTY, 0) / sowing.length;
  const dryMonths = [...new Set(sowing.flatMap(({ assessment }) => assessment.dryMonths))];
  return value > 0 ? [{ kind: "sowing-dry", label: `siembra en meses secos (${formatMonths(dryMonths)})`, value }] : [];
}

/**
 * Penalizaciones por clima del sitio y agua declarada: temperatura media fuera del rango de los cultivos,
 * heladas frecuentes sin tolerancia documentada y cultivos de alto consumo cuando el agricultor tiene poca agua.
 */
function climatePenalties(crops: readonly Crop[], indicators: Indicators, years: number, waterAvailability: WaterAvailability | undefined): Penalty[] {
  const temperature = indicators.meanTemperatureC ?? null;
  const frostPerYear = perYear(indicators.frostRiskDays, years);
  const waterUseShare = average(crops, (crop) => crop.waterUse) / MAX_SCORE;
  const slopeRisk = slopeErosionExposure(crops, indicators.slopePercent, indicators.extremeRainThresholdMm) * MAX_SLOPE_EROSION_PENALTY;
  const penalties: Penalty[] = [
    { kind: "temperature", label: `temperatura fuera del rango de los cultivos (media del sitio ${temperature?.toFixed(1)} °C)`, value: temperature === null ? 0 : temperatureMismatch(crops, temperature) * MAX_TEMPERATURE_PENALTY },
    { kind: "frost", label: `heladas (≈${frostPerYear.toFixed(0)} días al año bajo ${FROST_THRESHOLD_C} °C)`, value: frostExposure(crops, frostPerYear) * MAX_FROST_PENALTY },
    { kind: "water-scarcity", label: "poca agua disponible para cultivos de alto consumo", value: waterAvailability === "low" ? waterUseShare * MAX_WATER_SCARCITY_PENALTY : 0 },
    { kind: "slope", label: `ladera (${indicators.slopePercent?.toFixed(0)} % de pendiente) con baja cobertura frente a lluvias fuertes`, value: slopeRisk },
  ];
  return penalties.filter((penalty) => penalty.value > 0);
}

/** Castiga repetir la misma familia botánica en relevos seguidos: completa para el monocultivo, nula si siempre se alterna o si no hay dato de familia. */
function pestCyclePenalties(familyBreak: number | null): Penalty[] {
  if (familyBreak === null || familyBreak >= 1) return [];
  return [{ kind: "pests", label: "repetir la misma familia botánica en relevos seguidos (plagas y enfermedades)", value: (1 - familyBreak) * MAX_PEST_CYCLE_PENALTY }];
}

function evaluateRotation(rotation: Rotation, { crops: catalog, indicators, priorities, seasonality, years }: Context): Evaluation {
  const crops = resolveCrops(rotation, catalog);
  const dryness = drynessFactor(indicators);
  const weights = normalizedWeights(priorities);
  const values = criterionValues(crops, dryness);
  const criteria = CRITERIA.map((key) => ({ key, label: LABELS[key], weight: weights[key], value: values[key] }));
  const sowing = seasonality ? crops.map((crop) => ({ crop, assessment: assessSowing(crop.sowingMonths, seasonality) })) : null;
  const calendar = seasonality ? buildRotationCalendar(crops, seasonality) : null;
  const familyBreak = familyBreakShare(crops);
  const { waterAvailability } = priorities;
  const waterFactor = WATER_AVAILABILITY_DROUGHT_FACTOR[waterAvailability ?? "medium"];
  const sowingRisk = sowingPenalties(sowing).map((penalty) => ({ ...penalty, value: penalty.value * waterFactor }));
  const penalties = [...riskPenalties(crops, indicators, dryness, years, waterFactor), ...climatePenalties(crops, indicators, years, waterAvailability), ...sowingRisk, ...pestCyclePenalties(familyBreak)];
  const weighted = criteria.reduce((sum, criterion) => sum + criterion.weight * criterion.value, 0);
  const penalty = penalties.reduce((sum, item) => sum + item.value, 0);
  return { rotation, crops, criteria, penalties, sowing, calendar, years, familyBreak, waterAvailability, score: Math.round(Math.min(Math.max(weighted - penalty, 0), MAX_SCORE) * 100) / 100 };
}

const oneDecimal = (value: number) => value.toFixed(1);

function explainWhy({ score, criteria, penalties }: Evaluation): string {
  const weighted = criteria.filter((criterion) => criterion.weight > 0).sort((a, b) => b.weight * b.value - a.weight * a.value).slice(0, 2);
  const top = weighted.map((criterion) => `${criterion.label} (${oneDecimal(criterion.value)}/5)`).join(" y ");
  const penalty = penalties.length > 0 ? ` Se descuentan puntos por riesgo de ${penalties.map((item) => item.label).join(" y ")}.` : "";
  return `Obtiene ${oneDecimal(score)}/5 según tus prioridades; lo que más suma es ${top}.${penalty} Es un apoyo a la decisión, no una certeza.`;
}

function sowingEvidence(sowing: SowingFinding[] | null, { waterBalanceMethod }: Indicators): string[] {
  const source = WATER_BALANCE_SOURCE[waterBalanceMethod === "potential" ? "potential" : "evland"];
  const lines = (sowing ?? []).filter(({ assessment }) => assessment.dryMonths.length + assessment.wetMonths.length > 0).map(({ crop, assessment }) => {
    const verdict = assessment.dryMonths.length === 0 ? "ningún mes cae en época seca del sitio" : `en época seca del sitio: ${formatMonths(assessment.dryMonths)}`;
    return `Siembra de ${crop.name} (${formatMonths(crop.sowingMonths)}): ${verdict} (${source}; meses de siembra del catálogo).`;
  });
  const rule = `Mes seco: lluvia media del mes menor al ${(SEASON_DRY_RAIN_RATIO * 100).toFixed(0)} % del promedio mensual del sitio, o evaporación mayor que la lluvia (regla de diseño, no dato NASA).`;
  return lines.length > 0 ? [...lines, rule] : [];
}

const WATER_BALANCE_SOURCE = {
  potential: "NASA POWER, PRECTOTCORR; evaporación potencial estimada con Hargreaves–Samani a partir de T2M, T2M_MIN, T2M_MAX y la latitud",
  evland: "NASA POWER, PRECTOTCORR y EVLAND",
} as const;

function balanceEvidence(balance: number, { waterBalanceMethod }: Indicators): string {
  const potential = waterBalanceMethod === "potential";
  const demand = potential ? "evaporación potencial estimada" : "evaporación";
  return `Balance hídrico medio (lluvia − ${demand}): ${oneDecimal(balance)} mm/mes (${WATER_BALANCE_SOURCE[potential ? "potential" : "evland"]}).`;
}

/** "1907 en 10 años (≈191 al año)": el total de la serie y su promedio anual. */
function daysPerYearText(days: number, years: number): string {
  return `${days} en ${years} ${years === 1 ? "año" : "años"} (≈${perYear(days, years).toFixed(0)} al año)`;
}

/** Familias de la secuencia y cuántos relevos cambian de familia; vacío si el catálogo no trae las familias. */
function familyEvidence({ crops, familyBreak }: Evaluation): string[] {
  if (familyBreak === null) return [];
  const relays = crops.length;
  const changes = Math.round(familyBreak * relays);
  return [`Familias botánicas de la secuencia: ${crops.map((crop) => crop.family).join(" → ")}; cambia de familia en ${changes} de ${relays} ${relays === 1 ? "relevo" : "relevos"}, contando la vuelta al primer cultivo (catálogo).`];
}

function durationEvidence(crops: readonly Crop[]): string {
  const total = crops.reduce((sum, crop) => sum + crop.cycleDays, 0);
  const detail = crops.length === 1 ? `${total}` : `${crops.map((crop) => crop.cycleDays).join(" + ")} = ${total}`;
  return `Duración de la secuencia: ${detail} días de cultivo (ciclos típicos del catálogo, no datos del lote).`;
}

const WATER_AVAILABILITY_LABELS: Record<WaterAvailability, string> = { low: "baja", medium: "media", high: "alta" };

/** Temperatura media del sitio y rango de cada cultivo; incluye el ajuste por altitud (estimada o declarada) cuando se aplicó. */
function temperatureEvidence(crops: readonly Crop[], { meanTemperatureC, cellMeanTemperatureC, cellElevationMeters, siteElevationMeters, terrainSource }: Indicators): string[] {
  if (meanTemperatureC === undefined || meanTemperatureC === null) return [];
  const ranges = crops.flatMap((crop) => (crop.temperatureC ? [`${commonName(crop)} ${formatTemperatureRange(crop.temperatureC)}`] : []));
  const detail = ranges.length > 0 ? ` Rango en que crece bien según el catálogo: ${ranges.join("; ")}.` : "";
  const adjusted = cellMeanTemperatureC !== undefined && cellMeanTemperatureC !== null && cellElevationMeters !== undefined && siteElevationMeters !== undefined;
  const origin = terrainSource === "user" ? "altitud declarada por el agricultor" : "altitud leída de NASA SRTM en el punto piloto más cercano";
  const sourceNote = adjusted
    ? `(NASA POWER, T2M de ${cellMeanTemperatureC.toFixed(1)} °C en celda a ${cellElevationMeters.toFixed(0)} m, ajustada a ${siteElevationMeters.toFixed(0)} m con ${origin})`
    : "(NASA POWER, T2M)";
  return [`Temperatura media del sitio: ${meanTemperatureC.toFixed(1)} °C ${sourceNote}.${detail}`];
}

function terrainEvidence({ slopePercent, terrainSource }: Indicators): string[] {
  if (slopePercent === undefined) return [];
  const origin = terrainSource === "user" ? "declarada por el agricultor" : "NASA SRTM, punto piloto más cercano";
  return [`Pendiente del terreno: ${slopePercent.toFixed(0)} % (${origin}).`];
}

/** Racha seca más larga y año más seco de la serie, con su dato de NASA POWER. */
function droughtHistoryEvidence({ longestDrySpellDays, meanAnnualDrySpellDays, worstYear, waterDeficitMm }: Indicators): string[] {
  const spell = longestDrySpellDays === undefined ? [] : [`Racha seca más larga: ${longestDrySpellDays} días seguidos con menos de ${DRY_DAY_RAIN_MM} mm de lluvia${meanAnnualDrySpellDays === null || meanAnnualDrySpellDays === undefined ? "" : ` (la racha máxima de cada año promedia ${oneDecimal(meanAnnualDrySpellDays)} días)`} (NASA POWER, PRECTOTCORR).`];
  const worst = worstYear === undefined ? [] : [`Año más seco de la serie: ${worstYear.year}, con un balance hídrico de ${oneDecimal(worstYear.waterBalanceMm)} mm/mes${waterDeficitMm === null ? "" : ` frente a ${oneDecimal(waterDeficitMm)} mm/mes del promedio`} (NASA POWER).`];
  return [...spell, ...worst];
}

function buildEvidence(evaluation: Evaluation, indicators: Indicators): string[] {
  const { criteria, crops, sowing, years, waterAvailability } = evaluation;
  const { waterDeficitMm: balance, heatStressDays, frostRiskDays, extremeRainThresholdMm: rain, meanRootZoneWetness: wetness } = indicators;
  return [
    ...(balance === null ? [] : [balanceEvidence(balance, indicators)]),
    `Días con T2M_MAX > ${HEAT_STRESS_THRESHOLD_C} °C: ${daysPerYearText(heatStressDays, years)}; días con T2M_MIN < ${FROST_THRESHOLD_C} °C: ${daysPerYearText(frostRiskDays, years)} (NASA POWER${isElevationAdjusted(indicators) ? ", temperaturas ajustadas a la altitud del lote" : ""}).`,
    ...droughtHistoryEvidence(indicators),
    ...(rain === null ? [] : [`Lluvia diaria extrema (percentil 95): ${oneDecimal(rain)} mm/día (NASA POWER, PRECTOTCORR).`]),
    ...(wetness === null ? [] : [`Humedad media de la zona radicular: ${wetness.toFixed(2)} (NASA POWER, GWETROOT; proxy, no medición del lote).`]),
    ...criteria.filter((criterion) => criterion.weight > 0).map((criterion) => `${criterion.label}: ${oneDecimal(criterion.value)}/5 con peso ${(criterion.weight * 100).toFixed(0)} %.`),
    ...temperatureEvidence(crops, indicators),
    ...terrainEvidence(indicators),
    ...(waterAvailability ? [`Disponibilidad de agua declarada por el agricultor: ${WATER_AVAILABILITY_LABELS[waterAvailability]}.`] : []),
    ...sowingEvidence(sowing, indicators),
    ...(evaluation.calendar ? calendarEvidence(evaluation.calendar) : []),
    ...familyEvidence(evaluation),
    durationEvidence(crops),
    ...crops.map((crop) => `Atributos de ${crop.name}: ${crop.source}.`),
  ];
}

const BENEFITS: { pick: (crop: Crop) => number; text: string }[] = [
  { pick: (crop) => crop.nitrogenFixation, text: "Fija nitrógeno y puede reducir la necesidad de fertilizante." },
  { pick: (crop) => crop.organicMatter, text: "Aporta materia orgánica al suelo." },
  { pick: (crop) => crop.erosionReduction, text: "Ayuda a proteger el suelo de la erosión." },
  { pick: (crop) => crop.forageValue, text: "Tiene valor como forraje." },
  { pick: (crop) => crop.marketPotential, text: "Tiene buen potencial de mercado según el catálogo." },
  { pick: (crop) => crop.droughtTolerance, text: "Tolera periodos secos." },
];

function buildBenefits({ crops, familyBreak }: Evaluation): string[] {
  const alternates = familyBreak === 1 ? ["Alterna familias botánicas en todos los relevos, lo que ayuda a cortar ciclos de plagas y enfermedades."] : [];
  const found = [...alternates, ...BENEFITS.filter(({ pick }) => average(crops, pick) >= HIGH_ATTRIBUTE_THRESHOLD).map(({ text }) => text)];
  return found.length > 0 ? found : ["Ninguna ventaja destaca en los atributos del catálogo; su valor es de referencia."];
}

function familyRisks({ crops, familyBreak }: Evaluation): string[] {
  if (familyBreak === null || familyBreak >= 1) return [];
  if (crops.length === 1) return [`Es un monocultivo de ${commonName(crops[0])}: repetir siempre la misma familia (${crops[0].family}) favorece que se acumulen plagas y enfermedades del suelo.`];
  return ["Repite la misma familia botánica en relevos seguidos, lo que corta menos los ciclos de plagas y enfermedades."];
}

/** Un riesgo por cada cultivo cuya temperatura buena no incluye la media del sitio. */
function temperatureRisks(crops: readonly Crop[], { meanTemperatureC }: Indicators): string[] {
  if (meanTemperatureC === undefined || meanTemperatureC === null) return [];
  return crops.flatMap((crop) => {
    if (!crop.temperatureC) return [];
    const suitability = temperatureSuitability(crop.temperatureC, meanTemperatureC);
    if (suitability >= 1) return [];
    const side = meanTemperatureC < crop.temperatureC.goodMin ? "por debajo" : "por encima";
    const beyond = suitability === 0 ? "; además está fuera del límite que da su fuente, así que es poco probable que produzca" : "";
    return [`La temperatura media del sitio (${meanTemperatureC.toFixed(1)} °C) queda ${side} del rango en que ${commonName(crop)} crece bien (${formatTemperatureRange(crop.temperatureC)})${beyond}.`];
  });
}

function frostRisks(crops: readonly Crop[], indicators: Indicators, years: number): string[] {
  const unprotected = frostUnprotected(crops);
  if (indicators.frostRiskDays === 0 || unprotected.length === 0) return [];
  return [`La serie registra ≈${perYear(indicators.frostRiskDays, years).toFixed(0)} días al año con riesgo de helada y el catálogo no documenta tolerancia a heladas para ${unprotected.map(commonName).join(", ")}.`];
}

function buildRisks(evaluation: Evaluation, indicators: Indicators): string[] {
  const { crops, sowing, years } = evaluation;
  const low = (pick: (crop: Crop) => number) => average(crops, pick) < LOW_ATTRIBUTE_THRESHOLD;
  const risks: string[] = [];
  if (low((crop) => crop.heatTolerance)) risks.push("Baja tolerancia al calor según el catálogo.");
  if (low((crop) => crop.droughtTolerance) && drynessFactor(indicators) > 0) risks.push("Baja tolerancia a sequía en un sitio donde la evaporación supera a la lluvia.");
  if (average(crops, (crop) => crop.waterUse) >= HIGH_ATTRIBUTE_THRESHOLD && drynessFactor(indicators) > 0) risks.push("Alto uso de agua en un sitio con déficit hídrico.");
  if (low((crop) => crop.droughtTolerance) && (indicators.longestDrySpellDays ?? 0) >= DRY_SPELL_ALERT_DAYS) risks.push(`Racha seca de hasta ${indicators.longestDrySpellDays} días en la serie: con baja tolerancia a sequía, el cultivo puede sufrir en ese tramo.`);
  if (low((crop) => crop.droughtTolerance) && worstYearDryness(indicators) > drynessFactor(indicators)) risks.push(`En el año más seco (${indicators.worstYear?.year}) el balance hídrico fue de ${oneDecimal(indicators.worstYear?.waterBalanceMm ?? 0)} mm/mes: un año así pondría a prueba a un cultivo de baja tolerancia a sequía.`);
  risks.push(...temperatureRisks(crops, indicators), ...frostRisks(crops, indicators, years));
  if (indicators.slopePercent !== undefined && indicators.slopePercent > SLOPE_CAUTION_THRESHOLD_PERCENT && average(crops, (crop) => crop.erosionReduction) < HIGH_ATTRIBUTE_THRESHOLD) {
    risks.push(`Lote en ladera (${indicators.slopePercent.toFixed(0)} % de pendiente) con cobertura insuficiente frente a aguaceros fuertes.`);
  }
  if (evaluation.waterAvailability === "low" && average(crops, (crop) => crop.waterUse) >= HIGH_ATTRIBUTE_THRESHOLD) risks.push("Alto consumo de agua y el agricultor declara poca agua disponible.");
  if (low((crop) => crop.marketPotential)) risks.push("Bajo potencial de mercado según el catálogo.");
  for (const { crop, assessment } of sowing ?? []) {
    if (assessment.dryMonths.length > 0) risks.push(`Parte de los meses de siembra de ${crop.name} (${formatMonths(assessment.dryMonths)}) cae en época seca del sitio.`);
  }
  if (evaluation.calendar) risks.push(...calendarRisks(evaluation.calendar, crops));
  risks.push(...familyRisks(evaluation));
  return [...risks, "El puntaje es una simplificación por reglas: no captura plagas, precios, costos ni manejo real."];
}

function sowingGaps(sowing: SowingFinding[] | null): string[] {
  if (!sowing) return ["El calendario de siembra de cada cultivo no se cruzó con la estacionalidad de lluvia: el calendario del catálogo solo es válido para el Eje Cafetero (Colombia)."];
  const unknown = sowing.filter(({ assessment }) => assessment.unknownMonths.length > 0)
    .map(({ crop, assessment }) => `Hay meses de siembra de ${crop.name} (${formatMonths(assessment.unknownMonths)}) sin dato de lluvia; no se pudo evaluar si caen en época seca.`);
  return ["Los meses de siembra salen del catálogo (preliminares) y se cruzaron con promedios mensuales de lluvia: no distinguen años secos o lluviosos (El Niño/La Niña) ni un calendario real por cultivo y municipio.", ...unknown];
}

function familyGap(familyBreak: number | null): string {
  return familyBreak === null
    ? "El catálogo no trae la familia botánica de todos los cultivos: no se evaluó si la rotación alterna familias."
    : "No hay datos de plagas ni enfermedades del lote: alternar familias botánicas es una regla agronómica general, no un diagnóstico.";
}

function temperatureGaps(crops: readonly Crop[], { meanTemperatureC }: Indicators): string[] {
  if (meanTemperatureC === undefined || meanTemperatureC === null) return ["No hay temperatura media del sitio: no se evaluó la aptitud térmica de los cultivos."];
  const unknown = crops.filter((crop) => !crop.temperatureC).map(commonName);
  return [
    "La temperatura es el promedio de una celda de unos 50 km de NASA POWER: en montaña la del lote cambia con la altitud y puede diferir varios grados.",
    ...(unknown.length > 0 ? [`El catálogo no trae rango de temperatura para ${unknown.join(", ")}: no se evaluó su aptitud térmica.`] : []),
  ];
}

/** ¿Se llevaron las temperaturas de la celda de NASA POWER a la altitud del lote? */
function isElevationAdjusted({ cellElevationMeters, siteElevationMeters }: Indicators): boolean {
  return cellElevationMeters !== undefined && siteElevationMeters !== undefined;
}

/**
 * Las muestras de terreno precargadas son lecturas reales de NASA SRTM, pero de un punto piloto (hasta ~9 km del lote), no del lote.
 * Y la corrección por altitud usa un gradiente promedio también para mínimas, máximas y evaporación: es un supuesto.
 */
function terrainGaps(indicators: Indicators): string[] {
  return [
    ...(indicators.terrainSource === "srtm-sample" ? ["La altitud y la pendiente son lecturas de NASA SRTM (~30 m) en el punto piloto más cercano de la zona, no del lote: si tu lote está en otra ladera pueden diferir."] : []),
    ...(isElevationAdjusted(indicators) ? ["La corrección por altitud aplica el mismo gradiente andino promedio (~0,6 °C por cada 100 m) a la media, las mínimas y las máximas, y de ahí sale la evaporación estimada: es un supuesto, no una medición en el lote."] : []),
  ];
}

function seriesLengthGap(years: number): string[] {
  return years < MIN_YEARS_FOR_WORST_YEAR ? [`La serie climática cubre solo ${years} ${years === 1 ? "año" : "años"}: no alcanza para ver cómo cambia la lluvia de un año a otro ni identificar el año más seco.`] : [];
}

function buildGaps(indicators: Indicators, { crops, sowing, familyBreak, calendar, years }: Evaluation): string[] {
  const missing = Object.entries(indicators.missingByParameter).filter(([, days]) => days > 0).map(([name, days]) => `Faltaron ${days} días de dato en ${name}.`);
  return [
    "No hay datos de suelo (textura, fertilidad, pendiente) ni de precios locales.",
    "Los datos de NASA POWER son de malla y no miden el lote específico.",
    ...seriesLengthGap(years),
    ...temperatureGaps(crops, indicators),
    ...terrainGaps(indicators),
    ...sowingGaps(sowing),
    ...(calendar ? [calendarGap()] : []),
    familyGap(familyBreak),
    ...(indicators.waterDeficitMm === null ? ["No se pudo calcular el balance hídrico; el criterio de agua usa solo los atributos del cultivo."] : []),
    ...missing,
  ];
}

function buildResult(evaluation: Evaluation, indicators: Indicators): RotationResult {
  return {
    rotation: evaluation.rotation,
    score: evaluation.score,
    whySuggested: explainWhy(evaluation),
    evidence: buildEvidence(evaluation, indicators),
    benefits: buildBenefits(evaluation),
    informationGaps: buildGaps(indicators, evaluation),
    risks: buildRisks(evaluation, indicators),
    validateWithLocalExpert: [
      `Variedades y fechas de siembra locales de ${evaluation.crops.map((crop) => crop.name).join(", ")}.`,
      "Confirmar con un agrónomo local los atributos del catálogo y su adecuación al sitio.",
    ],
    ...(evaluation.calendar ? { calendar: evaluation.calendar } : {}),
    plain: buildPlain({
      crops: evaluation.crops, criteria: evaluation.criteria, penaltyKinds: evaluation.penalties.map((penalty) => penalty.kind), indicators,
      dryness: drynessFactor(indicators), sowing: evaluation.sowing, calendar: evaluation.calendar, familyBreak: evaluation.familyBreak, waterAvailability: evaluation.waterAvailability,
    }),
  };
}

/**
 * Puntúa cada rotación en la escala 0–5: Σ(peso de la prioridad × puntaje del criterio) − penalizaciones de riesgo
 * (calor, sequía, temperatura media fuera del rango del cultivo, heladas, poca agua declarada, siembra en meses secos
 * y repetir la misma familia botánica en relevos seguidos).
 * Los pesos salen de las prioridades normalizadas; los puntajes combinan atributos del catálogo con los indicadores del sitio.
 * Devuelve los resultados en el mismo orden de entrada (la línea base primero). Lanza un Error si una rotación usa un
 * cultivo fuera del catálogo o no tiene cultivos.
 */
export function scoreRotations({ rotations, yearsAnalyzed = 1, ...context }: ScoringInput): RotationResult[] {
  const years = Math.max(yearsAnalyzed, 1);
  return rotations.map((rotation) => buildResult(evaluateRotation(rotation, { ...context, years }), context.indicators));
}
