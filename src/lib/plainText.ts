import type { Crop, Indicators, RotationCalendar, RotationPlain, UserPriorities } from "../types";
import { frostUnprotected, temperatureSuitability } from "./climateFit";
import { HIGH_ATTRIBUTE_THRESHOLD, LOW_ATTRIBUTE_THRESHOLD, SLOPE_CAUTION_THRESHOLD_PERCENT } from "./config";
import { commonName } from "./rotations";

/** Qué castigó el puntaje; permite explicarlo en palabras simples sin leer las etiquetas técnicas. */
export type PenaltyKind = "heat" | "drought" | "temperature" | "frost" | "water-scarcity" | "slope" | "sowing-dry" | "pests";
export type PriorityKey = "waterSaving" | "extraIncome" | "soilImprovement" | "erosionReduction" | "lowRisk";

export type PlainInput = {
  crops: readonly Crop[];
  /** Criterios con su peso (suma 1) y puntaje 0–5. */
  criteria: readonly { key: PriorityKey; weight: number; value: number }[];
  penaltyKinds: readonly PenaltyKind[];
  indicators: Indicators;
  /** Qué tan seco es el sitio (0–1), como lo calcula el motor. */
  dryness: number;
  sowing: readonly { crop: Crop; assessment: { dryMonths: readonly number[]; unknownMonths: readonly number[] } }[] | null;
  calendar: RotationCalendar | null;
  familyBreak: number | null;
  waterAvailability: UserPriorities["waterAvailability"];
};

const GOAL_WORDS: Record<PriorityKey, string> = {
  waterSaving: "ahorrar agua", extraIncome: "ganar más", soilImprovement: "cuidar el suelo", erosionReduction: "frenar la erosión", lowRisk: "correr menos riesgos",
};
const PENALTY_WORDS: Record<PenaltyKind, string> = {
  heat: "el calor", drought: "la falta de agua", temperature: "una temperatura que no le conviene", frost: "las heladas",
  "water-scarcity": "gastar mucha agua teniendo poca", slope: "la erosión en ladera", "sowing-dry": "sembrar en meses secos", pests: "las plagas por repetir la misma familia",
};

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;
const average = (crops: readonly Crop[], pick: (crop: Crop) => number) => crops.reduce((total, crop) => total + pick(crop), 0) / crops.length;
const joinWords = (words: readonly string[]) => words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} y ${words[words.length - 1]}`;
const names = (crops: readonly Crop[]) => joinWords([...new Set(crops.map(commonName))]);
/** Meses con su nombre completo (la voz del celular lee mal las abreviaturas). */
const monthWords = (months: readonly number[]) => joinWords([...months].sort((a, b) => a - b).map((month) => MONTH_NAMES[month - 1] as string));
const uniqueMonths = (months: readonly number[]) => [...new Set(months)].sort((a, b) => a - b);

function why({ criteria, penaltyKinds }: PlainInput): string {
  const top = criteria.filter((item) => item.weight > 0).sort((a, b) => b.weight * b.value - a.weight * a.value).slice(0, 2).map((item) => GOAL_WORDS[item.key]);
  const fits = top.length > 0 ? `Va bien con lo que más te importa: ${joinWords(top)}.` : "Es una opción para comparar.";
  const kinds = [...new Set(penaltyKinds)];
  const cautions = kinds.length > 0 ? ` Le quitamos puntos por ${joinWords(kinds.map((kind) => PENALTY_WORDS[kind]))}.` : "";
  return `${fits}${cautions} Es una ayuda para decidir, no una seguridad.`;
}

const BENEFITS: { pick: (crop: Crop) => number; text: string }[] = [
  { pick: (crop) => crop.nitrogenFixation, text: "Le da abono natural a la tierra: puedes necesitar menos fertilizante." },
  { pick: (crop) => crop.organicMatter, text: "Deja hojas y raíces que alimentan el suelo." },
  { pick: (crop) => crop.erosionReduction, text: "Protege la tierra para que la lluvia no se la lleve." },
  { pick: (crop) => crop.forageValue, text: "Sirve de comida para los animales." },
  { pick: (crop) => crop.marketPotential, text: "Suele tener buen mercado." },
  { pick: (crop) => crop.droughtTolerance, text: "Aguanta bien cuando llueve poco." },
];

function benefits({ crops, familyBreak }: PlainInput): string[] {
  const alternates = familyBreak === 1 ? ["Cambia de familia de planta en cada siembra, y así se cortan las plagas."] : [];
  const found = [...alternates, ...BENEFITS.filter(({ pick }) => average(crops, pick) >= HIGH_ATTRIBUTE_THRESHOLD).map(({ text }) => text)];
  return found.length > 0 ? found : ["No tiene una ventaja que se destaque."];
}

function temperatureRisks(crops: readonly Crop[], { meanTemperatureC }: Indicators): string[] {
  if (meanTemperatureC === undefined || meanTemperatureC === null) return [];
  return crops.flatMap((crop) => {
    if (!crop.temperatureC || temperatureSuitability(crop.temperatureC, meanTemperatureC) >= 1) return [];
    const side = meanTemperatureC < crop.temperatureC.goodMin ? "más fría" : "más calurosa";
    return [`Tu zona es ${side} de lo que le gusta a ${commonName(crop)}.`];
  });
}

function calendarRisks(calendar: RotationCalendar, crops: readonly Crop[]): string[] {
  const bare = uniqueMonths(calendar.months.filter(({ risk }) => risk === "bare-soil-rain").map(({ month }) => month));
  const risks = bare.length > 0 ? [`La tierra queda sin cultivo en meses de lluvia (${monthWords(bare)}): la lluvia puede llevársela.`] : [];
  for (const crop of new Set(crops)) {
    const stressed = uniqueMonths(calendar.months.filter(({ risk, cropId }) => risk === "water-stress" && cropId === crop.id).map(({ month }) => month));
    if (stressed.length > 0) risks.push(`${commonName(crop)} estaría creciendo en meses secos (${monthWords(stressed)}).`);
  }
  return risks;
}

function familyRisks({ crops, familyBreak }: PlainInput): string[] {
  if (familyBreak === null || familyBreak >= 1) return [];
  if (crops.length === 1) return [`Sembrar siempre ${commonName(crops[0] as Crop)} hace que se acumulen plagas y enfermedades en la tierra.`];
  return ["Repite la misma familia de planta seguido, y eso deja que crezcan plagas."];
}

function risks(input: PlainInput): string[] {
  const { crops, indicators, dryness, sowing, calendar, waterAvailability } = input;
  const low = (pick: (crop: Crop) => number) => average(crops, pick) < LOW_ATTRIBUTE_THRESHOLD;
  const thirsty = average(crops, (crop) => crop.waterUse) >= HIGH_ATTRIBUTE_THRESHOLD;
  const found: string[] = [];
  if (low((crop) => crop.heatTolerance)) found.push("No aguanta bien el calor fuerte.");
  if (low((crop) => crop.droughtTolerance) && dryness > 0) found.push("Sufre cuando llueve poco, y en tu zona se pierde más agua de la que cae.");
  if (thirsty && dryness > 0) found.push("Gasta mucha agua y en tu zona el agua es justa.");
  found.push(...temperatureRisks(crops, indicators));
  const unprotected = indicators.frostRiskDays > 0 ? frostUnprotected(crops) : [];
  if (unprotected.length > 0) found.push(`Hay riesgo de heladas y no está comprobado que ${joinWords(unprotected.map(commonName))} las aguante.`);
  if (indicators.slopePercent !== undefined && indicators.slopePercent > SLOPE_CAUTION_THRESHOLD_PERCENT && average(crops, (crop) => crop.erosionReduction) < HIGH_ATTRIBUTE_THRESHOLD) found.push("Tu terreno es en ladera y una lluvia fuerte puede llevarse la tierra.");
  if (waterAvailability === "low" && thirsty) found.push("Gasta mucha agua y tú dijiste que tienes poca.");
  if (low((crop) => crop.marketPotential)) found.push("No suele tener buen mercado.");
  for (const { crop, assessment } of sowing ?? []) {
    if (assessment.dryMonths.length > 0) found.push(`Parte de la siembra de ${commonName(crop)} cae en meses secos (${monthWords(assessment.dryMonths)}).`);
  }
  if (calendar) found.push(...calendarRisks(calendar, crops));
  found.push(...familyRisks(input));
  return [...found, "El puntaje es una guía sencilla: no mira plagas, precios ni costos reales."];
}

function gaps({ crops, indicators, sowing, calendar, familyBreak }: PlainInput): string[] {
  const noTemperatureRange = crops.filter((crop) => !crop.temperatureC).map(commonName);
  const unknownMonths = (sowing ?? []).filter(({ assessment }) => assessment.unknownMonths.length > 0).map(({ crop }) => commonName(crop));
  const missingData = Object.values(indicators.missingByParameter).some((days) => days > 0);
  return [
    "No tenemos datos del suelo de tu terreno ni de los precios de tu zona.",
    "Los datos de la NASA son de toda la zona, no solo de tu terreno.",
    indicators.meanTemperatureC === undefined || indicators.meanTemperatureC === null ? "No pudimos saber la temperatura de tu zona." : "La temperatura es un promedio de una zona grande; en la montaña cambia con la altura.",
    ...(noTemperatureRange.length > 0 && indicators.meanTemperatureC !== undefined && indicators.meanTemperatureC !== null ? [`De ${joinWords(noTemperatureRange)} no sabemos qué temperatura aguanta.`] : []),
    ...(indicators.terrainSource === "srtm-sample" ? ["La altura y la pendiente vienen de un satélite de la NASA en un punto cercano de tu zona, no de tu terreno exacto."] : []),
    sowing === null ? "El calendario de siembra solo está listo para el Eje Cafetero." : "Los meses de siembra son generales: no tienen en cuenta años muy secos o muy lluviosos (El Niño y La Niña).",
    ...(unknownMonths.length > 0 ? [`No sabemos si algunos meses de siembra de ${joinWords(unknownMonths)} son secos.`] : []),
    ...(calendar ? ["El calendario es solo un ejemplo con épocas típicas, no tus fechas reales."] : []),
    familyBreak === null ? "No sabemos si esta mezcla cambia de familia de planta." : "No sabemos si tu terreno tiene plagas o enfermedades.",
    ...(indicators.waterDeficitMm === null ? ["No pudimos saber si el agua alcanza; solo miramos cuánta agua gasta cada cultivo."] : []),
    ...(missingData ? ["Al clima le faltaron algunos días de datos."] : []),
  ];
}

function validate({ crops }: PlainInput): string[] {
  return [`Pregúntale a un técnico de tu zona qué variedades y fechas de siembra sirven para ${names(crops)}.`, "Pídele que revise si esta opción de verdad le va a tu terreno."];
}

/** Los mismos temas del resultado técnico, dichos en palabras simples y sin cifras ni siglas. */
export function buildPlain(input: PlainInput): RotationPlain {
  return { why: why(input), benefits: benefits(input), risks: risks(input), gaps: gaps(input), validate: validate(input) };
}
