import type { CurrentSeason, CurrentSeasonStatus, Indicators, MonthlyClimate, RotationResult } from "../../types";
import { CURRENT_SEASON_BAR_MAX_PERCENT, CURRENT_SEASON_DRY_STREAK_NOTICE_DAYS, CURRENT_SEASON_TEMPERATURE_NOTICE_C } from "../config";
import { summarizeMonthlyClimate } from "./monthlyClimateSummary";

/** Un pedazo de texto para leer en voz alta; con `audioId` se usa la grabación `public/audio/<audioId>.mp3` si existe. */
export type SpeechItem = { text: string; audioId?: string };

export const MAX_STARS = 5;
export const BASELINE_ROTATION_ID = "baseline";

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const;

/** El puntaje del motor va de 0 a 5: se muestra como estrellas llenas. */
export function scoreToStars(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(MAX_STARS, Math.max(0, Math.round(score)));
}

/** Posición de la rotación con mayor puntaje (la primera si empatan); -1 si no hay ninguna. */
export function bestRotationIndex(rotations: readonly Pick<RotationResult, "score">[]): number {
  let best = -1;
  rotations.forEach((result, index) => { if (best === -1 || result.score > (rotations[best] as { score: number }).score) best = index; });
  return best;
}

export const isCurrentRotation = (result: Pick<RotationResult, "rotation">) => result.rotation.id === BASELINE_ROTATION_ID;

const fmt = (value: number, digits = 0) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(value);
const NO_DATA = "No hay datos suficientes para saberlo.";

export type ClimateTopicId = "water" | "heat" | "frost" | "rain" | "temperature" | "roots";
export type ClimateTopic = {
  id: ClimateTopicId;
  simpleTitle: string;
  technicalName: string;
  /** Qué significa el indicador: texto fijo, se puede grabar con la voz propia (`explanationAudioId`). */
  explanation: string;
  explanationAudioId: string;
  /** Qué dice el dato de esta zona: cambia con cada análisis, lo lee la voz del celular. */
  yourZone: string;
};

export const CLIMATE_EXPLANATIONS: Record<ClimateTopicId, Pick<ClimateTopic, "simpleTitle" | "technicalName" | "explanation">> = {
  water: { simpleTitle: "¿Alcanza el agua?", technicalName: "Balance hídrico", explanation: "Compara la lluvia que cae con el agua que se pierde por el calor y el viento. Si se pierde más de la que cae, a los cultivos les puede faltar agua." },
  heat: { simpleTitle: "¿Hace mucho calor?", technicalName: "Estrés por calor", explanation: "Cuenta los días en que el calor fue tan fuerte que puede dañar los cultivos." },
  frost: { simpleTitle: "¿Hay heladas?", technicalName: "Riesgo de helada", explanation: "Cuenta los días en que hizo tanto frío que el hielo puede quemar las plantas." },
  rain: { simpleTitle: "¿Llueve muy fuerte?", technicalName: "Lluvia diaria extrema", explanation: "Dice cuánta lluvia en un solo día se considera muy fuerte. Esas lluvias pueden arrastrar la tierra." },
  temperature: { simpleTitle: "¿Qué tan cálido es?", technicalName: "Temperatura media", explanation: "Es el promedio de la temperatura de todo el día y toda la noche." },
  roots: { simpleTitle: "¿Está húmeda la tierra?", technicalName: "Humedad de raíces", explanation: "Es qué tan mojada está la tierra donde llegan las raíces. Se mide por satélite para toda la zona, no solo para tu terreno." },
};

const daysPhrase = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

function zoneSentence(id: ClimateTopicId, indicators: Indicators): string {
  switch (id) {
    case "water":
      if (indicators.waterDeficitMm === null) return NO_DATA;
      return indicators.waterDeficitMm >= 0 ? "Aquí la lluvia alcanza: cae más agua de la que se pierde." : "Aquí se pierde más agua de la que cae: puede faltar agua.";
    case "heat":
      return indicators.heatStressDays === 0 ? "En los años analizados no hubo días de calor fuerte." : `Hubo ${daysPhrase(indicators.heatStressDays, "día", "días")} de calor fuerte en los años analizados.`;
    case "frost":
      return indicators.frostRiskDays === 0 ? "En los años analizados no hubo riesgo de helada." : `Hubo ${daysPhrase(indicators.frostRiskDays, "día", "días")} con riesgo de helada en los años analizados.`;
    case "rain":
      return indicators.extremeRainThresholdMm === null ? NO_DATA : `Se considera lluvia muy fuerte la que pasa de ${fmt(indicators.extremeRainThresholdMm)} milímetros en un día.`;
    case "temperature":
      return indicators.meanTemperatureC === null || indicators.meanTemperatureC === undefined ? NO_DATA : `El promedio es de ${fmt(indicators.meanTemperatureC, 1)} grados.`;
    case "roots":
      return indicators.meanRootZoneWetness === null ? NO_DATA : `La humedad promedio es del ${Math.round(indicators.meanRootZoneWetness * 100)} por ciento.`;
  }
}

const CLIMATE_ORDER: readonly ClimateTopicId[] = ["water", "heat", "frost", "rain", "temperature", "roots"];

/** Indicadores del análisis explicados con palabras simples: qué son y qué dicen en la zona. */
export function describeClimate(indicators: Indicators): ClimateTopic[] {
  return CLIMATE_ORDER.map((id) => ({ id, ...CLIMATE_EXPLANATIONS[id], explanationAudioId: `clima-${id}`, yourZone: zoneSentence(id, indicators) }));
}

export type RainMonth = { month: number; label: string; level: 1 | 2 | 3 | null };

/**
 * Calendario de lluvia: cada mes recibe 1, 2 o 3 gotas según su lugar entre los 12 meses de esta zona
 * (tercio más seco, medio y más lluvioso). Es una comparación entre meses, no un valor absoluto.
 */
export function rainCalendar(rows: readonly MonthlyClimate[]): RainMonth[] {
  const months = summarizeMonthlyClimate(rows);
  const ranked = months.filter((item) => item.precipitationMm !== null).sort((a, b) => (a.precipitationMm as number) - (b.precipitationMm as number));
  const levelByMonth = new Map<number, 1 | 2 | 3>();
  ranked.forEach((item, rank) => levelByMonth.set(item.month, rank < ranked.length / 3 ? 1 : rank < (2 * ranked.length) / 3 ? 2 : 3));
  return months.map((item) => ({ month: item.month, label: item.label, level: levelByMonth.get(item.month) ?? null }));
}

const listWords = (names: readonly string[]) => names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;

/** Frase para leer: los meses de más y de menos lluvia. Vacía si no hay datos de lluvia. */
export function rainCalendarSentence(calendar: readonly RainMonth[]): string {
  const named = (level: 1 | 3) => calendar.filter((item) => item.level === level).map((item) => MONTH_NAMES[item.month - 1] as string);
  const wet = named(3);
  const dry = named(1);
  if (wet.length === 0 && dry.length === 0) return "";
  return `Los meses con más lluvia son ${listWords(wet)}. Los meses más secos son ${listWords(dry)}.`;
}

const sentences = (list: readonly string[]) => list.map((item) => item.trim().replace(/[.]+$/, "")).join(". ") + ".";

/** Frase fija (grabable) que reemplaza a la lista técnica de evidencia en la versión simple. */
export const NASA_DATA_TEXT = "Usamos datos de la NASA de los últimos años en tu zona: lluvia, temperatura y humedad de la tierra.";
export const NASA_DATA_AUDIO_ID = "texto-datos-nasa";

export type RotationSection = { id: "why" | "evidence" | "benefits" | "risks" | "gaps" | "expert"; title: string; audioId: string; texts: readonly string[]; /** Grabación propia del texto, si es una frase fija. */ textAudioId?: string };

/**
 * Secciones del detalle de una rotación, en el orden en que se leen. Usa los textos simples (`result.plain`) y,
 * si la respuesta no los trae, los técnicos. La evidencia técnica completa queda en la vista de datos técnicos.
 */
export function rotationSections(result: RotationResult): RotationSection[] {
  const plain = result.plain;
  return [
    { id: "why", title: "¿Por qué?", audioId: "seccion-por-que", texts: [plain?.why ?? result.whySuggested] },
    plain
      ? { id: "evidence", title: "Datos que lo respaldan", audioId: "seccion-datos", texts: [NASA_DATA_TEXT], textAudioId: NASA_DATA_AUDIO_ID }
      : { id: "evidence", title: "Datos que lo respaldan", audioId: "seccion-datos", texts: result.evidence },
    { id: "benefits", title: "Lo bueno", audioId: "seccion-bueno", texts: plain?.benefits ?? result.benefits },
    { id: "risks", title: "Cuidado con", audioId: "seccion-cuidado", texts: plain?.risks ?? result.risks },
    { id: "gaps", title: "Lo que no sabemos", audioId: "seccion-no-sabemos", texts: plain?.gaps ?? result.informationGaps },
    { id: "expert", title: "Pregunta a un técnico", audioId: "seccion-tecnico", texts: plain?.validate ?? result.validateWithLocalExpert },
  ];
}

/** Todo el detalle de una rotación como lista de pedazos para leer: títulos fijos (grabables) y textos del análisis. */
export function rotationSpeechItems(result: RotationResult): SpeechItem[] {
  return rotationSections(result).flatMap((section) => [
    { text: section.title, audioId: section.audioId },
    section.textAudioId ? { text: sentences(section.texts), audioId: section.textAudioId } : { text: sentences(section.texts) },
  ]);
}

/** Explicación de un indicador para leer: la parte fija (grabable) y luego lo que dice el dato. */
export function climateTopicSpeechItems(topic: ClimateTopic): SpeechItem[] {
  return [{ text: `${topic.simpleTitle} ${topic.explanation}`, audioId: topic.explanationAudioId }, { text: topic.yourZone }];
}

export const RAIN_CALENDAR_INTRO = { title: "Calendario de lluvia", explanation: "Las gotas muestran cuánto suele llover cada mes. Una gota es poca lluvia y tres gotas es mucha lluvia. Sirve para saber cuándo sembrar.", audioId: "clima-calendario-lluvia" } as const;

export function rainCalendarSpeechItems(calendar: readonly RainMonth[]): SpeechItem[] {
  const sentence = rainCalendarSentence(calendar);
  return [{ text: `${RAIN_CALENDAR_INTRO.title}. ${RAIN_CALENDAR_INTRO.explanation}`, audioId: RAIN_CALENDAR_INTRO.audioId }, ...(sentence ? [{ text: sentence }] : [])];
}

export type CurrentSeasonTone = "dry" | "normal" | "wet";
export type CurrentSeasonCard = {
  title: string;
  technicalName: string;
  /** Qué significa: texto fijo, se puede grabar con la voz propia (`explanationAudioId`). */
  explanation: string;
  explanationAudioId: string;
  statusLabel: string;
  tone: CurrentSeasonTone;
  /** Resumen de una línea de cómo va la lluvia. */
  headline: string;
  /** Cuánto cayó en la ventana y cuánto es lo normal. */
  amount: string;
  /** Temperatura y días sin lluvia, solo si valen la pena. */
  details: string[];
  /** Fecha del dato y que es reciente, no un pronóstico. */
  note: string;
  /** Anchos de barra (0–100) de lluvia normal y reciente, con la misma escala. */
  normalBar: number;
  currentBar: number;
};

export const CURRENT_SEASON_EXPLANATION = {
  title: "¿Cómo va esta temporada?",
  technicalName: "Lluvia reciente frente a lo normal",
  explanation: "Compara la lluvia de los últimos meses con la que suele caer en esa misma época. Sirve para saber si este año va más seco o más lluvioso que de costumbre.",
  audioId: "clima-temporada",
} as const;

const SEASON_STATUS: Record<CurrentSeasonStatus, { label: string; tone: CurrentSeasonTone; headline: string }> = {
  "much-drier": { label: "Muy seca", tone: "dry", headline: "Ha llovido mucho menos de lo normal." },
  drier: { label: "Más seca de lo normal", tone: "dry", headline: "Ha llovido menos de lo normal." },
  normal: { label: "Normal", tone: "normal", headline: "Ha llovido lo normal para esta época." },
  wetter: { label: "Más lluviosa de lo normal", tone: "wet", headline: "Ha llovido más de lo normal." },
  "much-wetter": { label: "Muy lluviosa", tone: "wet", headline: "Ha llovido mucho más de lo normal." },
};

/** "20261112" → "12 de noviembre". */
const dayAndMonth = (date: string) => `${Number(date.slice(6, 8))} de ${MONTH_NAMES[Number(date.slice(4, 6)) - 1]}`;

function temperatureSentence(anomalyC: number | null): string[] {
  if (anomalyC === null) return [];
  if (Math.abs(anomalyC) < CURRENT_SEASON_TEMPERATURE_NOTICE_C) return ["La temperatura ha sido normal."];
  return [`Ha hecho ${fmt(Math.abs(anomalyC), 1)} grados ${anomalyC > 0 ? "más" : "menos"} calor de lo normal.`];
}

/** Anchos de barra de lluvia normal y reciente; la escala crece si llovió más que el tope para que ambas quepan. */
function seasonBars({ rainPercentOfNormal, rainMm }: Pick<CurrentSeason, "rainPercentOfNormal" | "rainMm">): { normalBar: number; currentBar: number } {
  if (rainPercentOfNormal === null) return { normalBar: 0, currentBar: rainMm > 0 ? 100 : 0 };
  const scale = Math.max(CURRENT_SEASON_BAR_MAX_PERCENT, rainPercentOfNormal);
  return { normalBar: (100 / scale) * 100, currentBar: (rainPercentOfNormal / scale) * 100 };
}

/** La temporada actual explicada con palabras simples: cómo va la lluvia y la temperatura frente a lo normal. */
export function describeCurrentSeason(season: CurrentSeason): CurrentSeasonCard {
  const status = SEASON_STATUS[season.status];
  return {
    ...CURRENT_SEASON_EXPLANATION, explanationAudioId: CURRENT_SEASON_EXPLANATION.audioId,
    statusLabel: status.label, tone: status.tone, headline: status.headline,
    amount: `En los últimos ${season.windowDays} días cayeron ${fmt(season.rainMm)} milímetros; lo normal en esa época son ${fmt(season.normalRainMm)}.`,
    details: [
      ...temperatureSentence(season.temperatureAnomalyC),
      ...(season.currentDryStreakDays >= CURRENT_SEASON_DRY_STREAK_NOTICE_DAYS ? [`Llevas ${season.currentDryStreakDays} días seguidos casi sin lluvia.`] : []),
    ],
    note: `Dato de la NASA hasta el ${dayAndMonth(season.lastDate)}. Es una lectura reciente que puede cambiar un poco y no es un pronóstico.`,
    ...seasonBars(season),
  };
}

/** La temporada actual para leer en voz alta: la explicación fija (grabable) y luego lo que dicen los datos. */
export function currentSeasonSpeechItems(card: CurrentSeasonCard): SpeechItem[] {
  return [{ text: `${card.title} ${card.explanation}`, audioId: card.explanationAudioId }, { text: sentences([card.headline, card.amount, ...card.details, card.note]) }];
}

/**
 * Cómo se unen los cultivos de una opción en pantalla: "then" (flecha) para una rotación, "with" (+) para un cultivo anual
 * asociado en las calles de uno permanente. El motor nombra las asociaciones "Café + Fríjol" y las rotaciones "Maíz → Soya".
 */
export function cropLink(rotation: Pick<RotationResult["rotation"], "name">): "then" | "with" {
  return rotation.name.includes(" + ") ? "with" : "then";
}
