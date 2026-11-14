import type { Crop, Indicators, Rotation, RotationResult, UserPriorities } from "../types";
import {
  SEASON_DRY_RAIN_RATIO, DRYNESS_REFERENCE_MM, FROST_THRESHOLD_C, HEAT_DAYS_REFERENCE, HEAT_STRESS_THRESHOLD_C, HIGH_ATTRIBUTE_THRESHOLD, LOW_ATTRIBUTE_THRESHOLD, MAX_RISK_PENALTY,
} from "./config";
import { assessSowing, formatMonths, type MonthSeason, type SowingAssessment } from "./seasonality";

type CriterionKey = "waterSaving" | "extraIncome" | "soilImprovement" | "erosionReduction" | "lowRisk";
type Criterion = { key: CriterionKey; label: string; weight: number; value: number };
type Penalty = { label: string; value: number };
type SowingFinding = { crop: Crop; assessment: SowingAssessment };
type Evaluation = { rotation: Rotation; crops: Crop[]; score: number; criteria: Criterion[]; penalties: Penalty[]; sowing: SowingFinding[] | null };

/**
 * Entrada del motor: todo llega como dato, sin leer archivos ni red.
 * `seasonality` (opcional) permite cruzar los meses de siembra con las épocas secas del sitio.
 */
export type ScoringInput = { rotations: readonly Rotation[]; crops: readonly Crop[]; indicators: Indicators; priorities: UserPriorities; seasonality?: readonly MonthSeason[] };

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
  const balance = indicators.waterDeficitMm;
  if (balance === null || balance >= 0) return 0;
  return Math.min(-balance / DRYNESS_REFERENCE_MM, 1);
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

function riskPenalties(crops: readonly Crop[], indicators: Indicators, dryness: number): Penalty[] {
  const heatShare = Math.min(indicators.heatStressDays / HEAT_DAYS_REFERENCE, 1);
  const heatGap = (MAX_SCORE - average(crops, (crop) => crop.heatTolerance)) / MAX_SCORE;
  const droughtGap = (MAX_SCORE - average(crops, (crop) => crop.droughtTolerance)) / MAX_SCORE;
  return [
    { label: `calor (${indicators.heatStressDays} días sobre ${HEAT_STRESS_THRESHOLD_C} °C)`, value: heatShare * heatGap * MAX_RISK_PENALTY },
    { label: "sequía (balance hídrico negativo)", value: dryness * droughtGap * MAX_RISK_PENALTY },
  ].filter((penalty) => penalty.value > 0);
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
  return value > 0 ? [{ label: `siembra en meses secos (${formatMonths(dryMonths)})`, value }] : [];
}

function evaluateRotation(rotation: Rotation, catalog: readonly Crop[], indicators: Indicators, priorities: UserPriorities, seasonality: readonly MonthSeason[] | undefined): Evaluation {
  const crops = resolveCrops(rotation, catalog);
  const dryness = drynessFactor(indicators);
  const weights = normalizedWeights(priorities);
  const values = criterionValues(crops, dryness);
  const criteria = CRITERIA.map((key) => ({ key, label: LABELS[key], weight: weights[key], value: values[key] }));
  const sowing = seasonality ? crops.map((crop) => ({ crop, assessment: assessSowing(crop.sowingMonths, seasonality) })) : null;
  const penalties = [...riskPenalties(crops, indicators, dryness), ...sowingPenalties(sowing)];
  const weighted = criteria.reduce((sum, criterion) => sum + criterion.weight * criterion.value, 0);
  const penalty = penalties.reduce((sum, item) => sum + item.value, 0);
  return { rotation, crops, criteria, penalties, sowing, score: Math.round(Math.min(Math.max(weighted - penalty, 0), MAX_SCORE) * 100) / 100 };
}

const oneDecimal = (value: number) => value.toFixed(1);

function explainWhy({ score, criteria, penalties }: Evaluation): string {
  const weighted = criteria.filter((criterion) => criterion.weight > 0).sort((a, b) => b.weight * b.value - a.weight * a.value).slice(0, 2);
  const top = weighted.map((criterion) => `${criterion.label} (${oneDecimal(criterion.value)}/5)`).join(" y ");
  const penalty = penalties.length > 0 ? ` Se descuentan puntos por riesgo de ${penalties.map((item) => item.label).join(" y ")}.` : "";
  return `Obtiene ${oneDecimal(score)}/5 según tus prioridades; lo que más suma es ${top}.${penalty} Es un apoyo a la decisión, no una certeza.`;
}

function sowingEvidence(sowing: SowingFinding[] | null): string[] {
  const lines = (sowing ?? []).filter(({ assessment }) => assessment.dryMonths.length + assessment.wetMonths.length > 0).map(({ crop, assessment }) => {
    const verdict = assessment.dryMonths.length === 0 ? "ningún mes cae en época seca del sitio" : `en época seca del sitio: ${formatMonths(assessment.dryMonths)}`;
    return `Siembra de ${crop.name} (${formatMonths(crop.sowingMonths)}): ${verdict} (NASA POWER, PRECTOTCORR y EVLAND; meses de siembra del catálogo).`;
  });
  const rule = `Mes seco: lluvia media del mes menor al ${(SEASON_DRY_RAIN_RATIO * 100).toFixed(0)} % del promedio mensual del sitio, o evaporación mayor que la lluvia (regla de diseño, no dato NASA).`;
  return lines.length > 0 ? [...lines, rule] : [];
}

function buildEvidence({ criteria, crops, sowing }: Evaluation, indicators: Indicators): string[] {
  const { waterDeficitMm: balance, heatStressDays, frostRiskDays, extremeRainThresholdMm: rain, meanRootZoneWetness: wetness } = indicators;
  return [
    ...(balance === null ? [] : [`Balance hídrico medio (lluvia − evaporación): ${oneDecimal(balance)} mm/mes (NASA POWER, PRECTOTCORR y EVLAND).`]),
    `Días con T2M_MAX > ${HEAT_STRESS_THRESHOLD_C} °C: ${heatStressDays}; días con T2M_MIN < ${FROST_THRESHOLD_C} °C: ${frostRiskDays} (NASA POWER).`,
    ...(rain === null ? [] : [`Lluvia diaria extrema (percentil 95): ${oneDecimal(rain)} mm/día (NASA POWER, PRECTOTCORR).`]),
    ...(wetness === null ? [] : [`Humedad media de la zona radicular: ${wetness.toFixed(2)} (NASA POWER, GWETROOT; proxy, no medición del lote).`]),
    ...criteria.filter((criterion) => criterion.weight > 0).map((criterion) => `${criterion.label}: ${oneDecimal(criterion.value)}/5 con peso ${(criterion.weight * 100).toFixed(0)} %.`),
    ...sowingEvidence(sowing),
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

function buildBenefits({ crops }: Evaluation): string[] {
  const found = BENEFITS.filter(({ pick }) => average(crops, pick) >= HIGH_ATTRIBUTE_THRESHOLD).map(({ text }) => text);
  return found.length > 0 ? found : ["Ninguna ventaja destaca en los atributos del catálogo; su valor es de referencia."];
}

function buildRisks({ crops, sowing }: Evaluation, indicators: Indicators): string[] {
  const low = (pick: (crop: Crop) => number) => average(crops, pick) < LOW_ATTRIBUTE_THRESHOLD;
  const risks: string[] = [];
  if (low((crop) => crop.heatTolerance)) risks.push("Baja tolerancia al calor según el catálogo.");
  if (low((crop) => crop.droughtTolerance) && drynessFactor(indicators) > 0) risks.push("Baja tolerancia a sequía en un sitio donde la evaporación supera a la lluvia.");
  if (average(crops, (crop) => crop.waterUse) >= HIGH_ATTRIBUTE_THRESHOLD && drynessFactor(indicators) > 0) risks.push("Alto uso de agua en un sitio con déficit hídrico.");
  if (indicators.frostRiskDays > 0) risks.push(`La serie registra ${indicators.frostRiskDays} días con riesgo de helada y el catálogo no incluye tolerancia a heladas.`);
  if (low((crop) => crop.marketPotential)) risks.push("Bajo potencial de mercado según el catálogo.");
  for (const { crop, assessment } of sowing ?? []) {
    if (assessment.dryMonths.length > 0) risks.push(`Parte de los meses de siembra de ${crop.name} (${formatMonths(assessment.dryMonths)}) cae en época seca del sitio.`);
  }
  return [...risks, "El puntaje es una simplificación por reglas: no captura plagas, precios, costos ni manejo real."];
}

function sowingGaps(sowing: SowingFinding[] | null): string[] {
  if (!sowing) return ["El calendario de siembra de cada cultivo no se cruzó con la estacionalidad de lluvia."];
  const unknown = sowing.filter(({ assessment }) => assessment.unknownMonths.length > 0)
    .map(({ crop, assessment }) => `Hay meses de siembra de ${crop.name} (${formatMonths(assessment.unknownMonths)}) sin dato de lluvia; no se pudo evaluar si caen en época seca.`);
  return ["Los meses de siembra salen del catálogo (preliminares) y se cruzaron con promedios mensuales de lluvia: no distinguen años secos o lluviosos (El Niño/La Niña) ni un calendario real por cultivo y municipio.", ...unknown];
}

function buildGaps(indicators: Indicators, sowing: SowingFinding[] | null): string[] {
  const missing = Object.entries(indicators.missingByParameter).filter(([, days]) => days > 0).map(([name, days]) => `Faltaron ${days} días de dato en ${name}.`);
  return [
    "No hay datos de suelo (textura, fertilidad, pendiente) ni de precios locales.",
    "Los datos de NASA POWER son de malla y no miden el lote específico.",
    ...sowingGaps(sowing),
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
    informationGaps: buildGaps(indicators, evaluation.sowing),
    risks: buildRisks(evaluation, indicators),
    validateWithLocalExpert: [
      `Variedades y fechas de siembra locales de ${evaluation.crops.map((crop) => crop.name).join(", ")}.`,
      "Confirmar con un agrónomo local los atributos del catálogo y su adecuación al sitio.",
    ],
  };
}

/**
 * Puntúa cada rotación en la escala 0–5: Σ(peso de la prioridad × puntaje del criterio) − penalizaciones de riesgo.
 * Los pesos salen de las prioridades normalizadas; los puntajes combinan atributos del catálogo con los indicadores del sitio.
 * Devuelve los resultados en el mismo orden de entrada (la línea base primero). Lanza un Error si una rotación usa un
 * cultivo fuera del catálogo o no tiene cultivos.
 */
export function scoreRotations({ rotations, crops, indicators, priorities, seasonality }: ScoringInput): RotationResult[] {
  return rotations.map((rotation) => buildResult(evaluateRotation(rotation, crops, indicators, priorities, seasonality), indicators));
}
