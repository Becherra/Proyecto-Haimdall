import type { AnalysisResponse, ClimateScenario, CurrentSeason, CurrentSeasonStatus, DataSource, Indicators, MonthlyClimate, RotationResult } from "../../types";
import { CURRENT_SEASON_DRY_STREAK_NOTICE_DAYS, CURRENT_SEASON_TEMPERATURE_NOTICE_C } from "../config";
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

export const MAX_SEASON_DROPS = 5;
export const NORMAL_SEASON_DROPS = 3;

export type CurrentSeasonTone = "dry" | "normal" | "wet";
export type CurrentSeasonCard = {
  title: string;
  technicalName: string;
  /** Qué significa: texto fijo, se puede grabar con la voz propia (`explanationAudioId`). */
  explanation: string;
  explanationAudioId: string;
  statusLabel: string;
  tone: CurrentSeasonTone;
  /** Resumen en lenguaje de campo de cómo va la lluvia en estos meses. */
  headline: string;
  /** Calor o fresco reciente, sequía seguida y consejo práctico para el lote. */
  details: string[];
  /** Fecha del dato y que cuenta lo que ya pasó, no un pronóstico. */
  note: string;
  /** Gotas de agua (0 a `MAX_SEASON_DROPS`) para comparar lo normal con este año sin usar gráficas ni porcentajes. */
  normalDrops: number;
  currentDrops: number;
};

export const CURRENT_SEASON_EXPLANATION = {
  title: "¿Cómo va esta temporada?",
  technicalName: "Lluvia reciente frente a lo normal",
  explanation: "Compara la lluvia de los últimos meses con la que suele caer en esa misma época. Sirve para saber si este año va más seco o más lluvioso que de costumbre.",
  audioId: "clima-temporada",
} as const;

const SEASON_STATUS: Record<CurrentSeasonStatus, { label: string; tone: CurrentSeasonTone; drops: number; headline: string }> = {
  "much-drier": { label: "Muy seca", tone: "dry", drops: 1, headline: "En estos últimos meses casi no ha llovido. La tierra está mucho más seca que en años normales." },
  drier: { label: "Más seca de lo normal", tone: "dry", drops: 2, headline: "En estos últimos meses ha llovido menos que en otros años para esta misma época." },
  normal: { label: "Normal", tone: "normal", drops: 3, headline: "En estos últimos meses ha llovido lo que suele llover todos los años en esta época." },
  wetter: { label: "Más lluviosa de lo normal", tone: "wet", drops: 4, headline: "En estos últimos meses ha caído más agua que en otros años para esta época." },
  "much-wetter": { label: "Muy lluviosa", tone: "wet", drops: 5, headline: "En estos últimos meses ha caído mucha más agua que de costumbre. La tierra está bien mojada." },
};

const SEASON_ADVICE: Record<CurrentSeasonTone, string> = {
  dry: "Qué vigilar: revisa la humedad del suelo y señales de marchitez; el efecto depende del cultivo, su etapa y si tienes riego.",
  normal: "Qué vigilar: la lluvia normal no garantiza humedad suficiente en el suelo. Revisa el terreno antes de decidir labores.",
  wet: "Qué vigilar: observa charcos, escorrentía y manchas en las hojas; el riesgo depende del drenaje, la pendiente y el cultivo.",
};

/** "20261112" → "12 de noviembre". */
const dayAndMonth = (date: string) => `${Number(date.slice(6, 8))} de ${MONTH_NAMES[Number(date.slice(4, 6)) - 1]}`;

function temperatureSentence(anomalyC: number | null): string[] {
  if (anomalyC === null) return [];
  if (Math.abs(anomalyC) < CURRENT_SEASON_TEMPERATURE_NOTICE_C) return ["El calor y el fresco han estado normales para esta época."];
  return [anomalyC > 0 ? "Además, los días han estado más calientes y bochornosos que de costumbre." : "Además, los días han estado más frescos que de costumbre."];
}

/** Gotas de lluvia normal (3 de 5) y de este año (1 a 5 según el estado); sin base histórica normal, no inventa gotas normales. */
function seasonDrops({ status, rainPercentOfNormal, rainMm }: Pick<CurrentSeason, "status" | "rainPercentOfNormal" | "rainMm">): { normalDrops: number; currentDrops: number } {
  if (rainPercentOfNormal === null) return { normalDrops: 0, currentDrops: rainMm > 0 ? MAX_SEASON_DROPS : 0 };
  return { normalDrops: NORMAL_SEASON_DROPS, currentDrops: SEASON_STATUS[status].drops };
}

/** La temporada actual explicada con palabras de campo y gotas de agua: sin milímetros, porcentajes ni gráficas. */
export function describeCurrentSeason(season: CurrentSeason): CurrentSeasonCard {
  const status = SEASON_STATUS[season.status];
  return {
    ...CURRENT_SEASON_EXPLANATION, explanationAudioId: CURRENT_SEASON_EXPLANATION.audioId,
    statusLabel: status.label, tone: status.tone, headline: status.headline,
    details: [
      ...temperatureSentence(season.temperatureAnomalyC),
      ...(season.currentDryStreakDays >= CURRENT_SEASON_DRY_STREAK_NOTICE_DAYS ? ["Llevas varios días seguidos sin que caiga un buen aguacero."] : []),
      SEASON_ADVICE[status.tone],
    ],
    note: `Miramos las lluvias hasta el ${dayAndMonth(season.lastDate)}. Esto cuenta lo que ya pasó en estos meses; no adivina si mañana va a llover.`,
    ...seasonDrops(season),
  };
}

/** La temporada actual para leer en voz alta: la explicación fija (grabable) y luego lo que pasa en el campo. */
export function currentSeasonSpeechItems(card: CurrentSeasonCard): SpeechItem[] {
  return [{ text: `${card.title} ${card.explanation}`, audioId: card.explanationAudioId }, { text: sentences([card.statusLabel, card.headline, ...card.details, card.note]) }];
}

/**
 * Cómo se unen los cultivos de una opción en pantalla: "then" (flecha) para una rotación, "with" (+) para un cultivo anual
 * asociado en las calles de uno permanente. El motor nombra las asociaciones "Café + Fríjol" y las rotaciones "Maíz → Soya".
 */
export function cropLink(rotation: Pick<RotationResult["rotation"], "name">): "then" | "with" {
  return rotation.name.includes(" + ") ? "with" : "then";
}

export type ScenarioPresetId = "normal" | "drought" | "wet" | "heat";
export type ScenarioPreset = {
  id: ScenarioPresetId;
  label: string;
  subtitle: string;
  scenario: ClimateScenario;
  notice: string;
};

/** Botones simples para que el agricultor pruebe qué pasa con sus cultivos si cambia el tiempo, sin usar porcentajes ni grados. */
export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  { id: "normal", label: "Clima normal", subtitle: "Como suele ser aquí", scenario: { tempDeltaC: 0, rainFactor: 1 }, notice: "Estás viendo tus cultivos con el clima habitual de tu zona." },
  { id: "drought", label: "Si viene sequía", subtitle: "Poca agua y más sol", scenario: { tempDeltaC: 1, rainFactor: 0.7 }, notice: "Estás probando qué pasaría en un año seco. Mira cómo cambian las estrellas de cada camino." },
  { id: "wet", label: "Si llueve mucho", subtitle: "Temporada de mucha agua", scenario: { tempDeltaC: 0, rainFactor: 1.35 }, notice: "Estás probando qué pasaría en un año de mucha agua. Mira qué cultivos aguantan mejor." },
  { id: "heat", label: "Si hace más calor", subtitle: "Días más bochornosos", scenario: { tempDeltaC: 2, rainFactor: 1 }, notice: "Estás probando qué pasaría si los días se ponen más calientes que de costumbre." },
] as const;

/** Identifica cuál botón de clima está activo; si no hay escenario o vuelve a 0/1, es "normal". */
export function activeScenarioPreset(scenario: ClimateScenario | undefined): ScenarioPreset {
  const temp = scenario?.tempDeltaC ?? 0;
  const rain = scenario?.rainFactor ?? 1;
  return SCENARIO_PRESETS.find((preset) => preset.scenario.tempDeltaC === temp && preset.scenario.rainFactor === rain) ?? SCENARIO_PRESETS[0]!;
}

export type NasaSupportItemId = "history" | "drought" | "worstYear" | "terrain";
export type NasaSupportItem = { id: NasaSupportItemId; title: string; body: string };

function terrainSupportText(indicators: Indicators): string | null {
  if (indicators.slopePercent === undefined && indicators.siteElevationMeters === undefined) return null;
  if ((indicators.slopePercent ?? 0) >= 20) return "Tu terreno tiene loma fuerte. Cuando llueve duro el agua corre rápido y puede llevarse la tierra buena y el abono.";
  if ((indicators.slopePercent ?? 0) >= 8) return "Tu terreno tiene algo de falda o inclinación. Sembrar atravesado a la loma y tapar el suelo ayuda a que el agua no arrastre la tierra.";
  return "Tu terreno es bastante parejo, así que el agua de lluvia se aprovecha mejor y casi no arrastra la tierra.";
}

/** Traduce el respaldo del análisis a tarjetas simples sin números raros ni jerga estadística. */
export function describeNasaSupport({ indicators }: Pick<AnalysisResponse, "indicators">): NasaSupportItem[] {
  const drySpell = indicators.longestDrySpellDays;
  const terrain = terrainSupportText(indicators);
  return [
    { id: "history", title: "Muchos años de memoria", body: "Miramos las lluvias, el calor y la humedad de muchos años hacia atrás con satélites de la NASA, para no guiarnos por un solo año bueno o malo." },
    ...(drySpell === undefined ? [] : [{
      id: "drought" as const,
      title: "Cuando aprieta el verano",
      body: drySpell >= 15
        ? "En los años difíciles han pasado varias semanas seguidas sin un buen aguacero. Por eso ayuda tener cultivos que tapen y guarden la humedad de la tierra."
        : "Incluso en épocas secas, en esta zona no suelen pasar demasiados días seguidos sin que caiga algo de agua.",
    }]),
    ...(indicators.worstYear ? [{
      id: "worstYear" as const,
      title: `El año más duro fue ${indicators.worstYear.year}`,
      body: `Ese año faltó más agua que en cualquier otro de los que revisamos. Las opciones con más estrellas buscan defenderte mejor si se repite un año parecido.`,
    }] : []),
    ...(terrain ? [{ id: "terrain" as const, title: "Cómo es la loma de tu lote", body: terrain }] : []),
  ];
}

type SimpleSourceCard = { title: string; body: string };

/** Tarjetas sencillas por tema. Varias fuentes técnicas (p. ej. T2M, T2M_MIN, T2M_MAX) se cuentan como una sola tarjeta. */
const SIMPLE_SOURCE_CARDS = {
  temperature: { title: "Calor y frío de tu región", body: "Satélites de la NASA que anotan todos los días qué tan caliente y qué tan frío estuvo, para saber si hay riesgo de heladas o de calor fuerte." },
  rain: { title: "Lluvias de tu región", body: "Satélites de la NASA que anotan todos los días cuánto llovió en tu zona, para saber en qué meses cae más agua." },
  evaporation: { title: "Agua que se pierde por el sol", body: "Calculamos cuánta agua se evapora con el calor para saber si la lluvia alcanza para los cultivos." },
  roots: { title: "Humedad de la tierra", body: "Medida desde el espacio de qué tan mojada está la tierra donde llegan las raíces. Sirve de pista, pero no cambia las estrellas." },
  recent: { title: "Cómo van estos últimos meses", body: "Lectura reciente del satélite para saber si esta temporada viene más seca o más lluviosa que de costumbre." },
  terrain: { title: "Altura y loma del terreno", body: "Mapa de la NASA que mide desde el espacio qué tan alto está tu zona y si tiene mucha pendiente. Es de un punto cercano, no de tu lote exacto." },
  terrainUser: { title: "Altura y loma que tú contaste", body: "La altura y la inclinación de tu lote vienen de lo que tú nos dijiste." },
  crops: { title: "Guía de cultivos del campo", body: "Información de qué tanta agua, qué clima y qué cuidados necesita cada cultivo. Son datos de partida: conviene revisarlos con un técnico de tu zona." },
} as const satisfies Record<string, SimpleSourceCard>;

type SimpleSourceCardId = keyof typeof SIMPLE_SOURCE_CARDS;

/** Id de la fuente técnica (ver `listDataSources`) → tarjeta sencilla. La radiación solar no se muestra: todavía no interviene en los puntajes. */
const SOURCE_TO_CARD: Record<string, SimpleSourceCardId | null> = {
  "power-t2m": "temperature", "power-t2m_min": "temperature", "power-t2m_max": "temperature",
  "power-prectotcorr": "rain", "power-evland": "evaporation", "power-gwetroot": "roots",
  "power-allsky_sfc_sw_dwn": null,
  "power-recent": "recent", "power-cell-elevation": "terrain", "terrain-srtm": "terrain", "terrain-user": "terrainUser",
  "crops-catalog": "crops",
};

/** Explica cada fuente de datos sin siglas ni palabras de ingeniero; las fuentes desconocidas conservan su nombre y uso originales. */
export function describeSimpleSources(sources: readonly DataSource[] = []): { id: string; title: string; body: string }[] {
  const seen = new Set<string>();
  return sources.flatMap((source) => {
    const cardId = SOURCE_TO_CARD[source.id];
    if (cardId === null) return [];
    const id = cardId ?? source.id;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, ...(cardId ? SIMPLE_SOURCE_CARDS[cardId] : { title: source.name, body: source.use }) }];
  });
}
