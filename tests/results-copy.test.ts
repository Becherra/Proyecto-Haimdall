import { describe, expect, it } from "vitest";
import { NASA_DATA_AUDIO_ID, NASA_DATA_TEXT, bestRotationIndex, climateTopicSpeechItems, describeClimate, rainCalendar, rainCalendarSentence, rotationSections, rotationSpeechItems, scoreToStars } from "../src/lib/ui/resultsCopy";
import type { Indicators, MonthlyClimate, RotationResult } from "../src/types";

const indicators: Indicators = { waterDeficitMm: -120.4, heatStressDays: 0, frostRiskDays: 3, extremeRainThresholdMm: 17.4, meanRootZoneWetness: 0.8, meanTemperatureC: 22.34, missingByParameter: {} };
const rotation = (score: number, id = "x"): RotationResult => ({ rotation: { id, name: id, cropIds: ["maiz"], description: "d" }, score, whySuggested: "Porque sí.", evidence: ["Dato A"], benefits: ["Beneficio 1", "Beneficio 2."], informationGaps: ["Vacío"], risks: ["Riesgo"], validateWithLocalExpert: ["Validar"] });
const month = (m: number, mm: number | null): MonthlyClimate => ({ year: 2020, month: m, meanTemperatureC: 20, precipitationMm: mm, evaporationMm: 1, rootZoneWetness: 0.5, missingByParameter: {} });

describe("scoreToStars", () => {
  it("redondea y limita de 0 a 5", () => {
    expect(scoreToStars(3.4)).toBe(3);
    expect(scoreToStars(4.6)).toBe(5);
    expect(scoreToStars(9)).toBe(5);
    expect(scoreToStars(-2)).toBe(0);
    expect(scoreToStars(Number.NaN)).toBe(0);
  });
});

describe("bestRotationIndex", () => {
  it("devuelve la de mayor puntaje y la primera si empatan", () => {
    expect(bestRotationIndex([rotation(2), rotation(4), rotation(4)])).toBe(1);
    expect(bestRotationIndex([])).toBe(-1);
  });
});

describe("describeClimate", () => {
  it("explica cada indicador con palabras simples", () => {
    const topics = describeClimate(indicators);
    expect(topics.map((topic) => topic.technicalName)).toContain("Balance hídrico");
    expect(topics.find((topic) => topic.id === "water")).toMatchObject({ simpleTitle: "¿Alcanza el agua?", explanationAudioId: "clima-water" });
    expect(topics.find((topic) => topic.id === "water")?.yourZone).toContain("puede faltar agua");
    expect(topics.find((topic) => topic.id === "heat")?.yourZone).toContain("no hubo días de calor");
    expect(topics.find((topic) => topic.id === "frost")?.yourZone).toContain("3 días");
    expect(topics.find((topic) => topic.id === "rain")?.yourZone).toContain("17 milímetros");
    expect(topics.find((topic) => topic.id === "roots")?.yourZone).toContain("80 por ciento");
  });
  it("dice que faltan datos en lugar de inventarlos", () => {
    const topics = describeClimate({ ...indicators, waterDeficitMm: null, extremeRainThresholdMm: null, meanRootZoneWetness: null, meanTemperatureC: null });
    for (const id of ["water", "rain", "roots", "temperature"]) expect(topics.find((topic) => topic.id === id)?.yourZone).toMatch(/No hay datos/);
  });
  it("usa singular con un solo día", () => {
    expect(describeClimate({ ...indicators, frostRiskDays: 1 }).find((topic) => topic.id === "frost")?.yourZone).toContain("1 día ");
  });
  it("la lectura separa la parte fija (grabable) de la del dato", () => {
    const [fixed, dynamic] = climateTopicSpeechItems(describeClimate(indicators)[0]!);
    expect(fixed?.audioId).toBe("clima-water");
    expect(dynamic?.audioId).toBeUndefined();
  });
});

describe("rainCalendar", () => {
  const rows = Array.from({ length: 12 }, (_, index) => month(index + 1, (index + 1) * 10));
  it("reparte 1, 2 y 3 gotas en tercios de meses", () => {
    const levels = rainCalendar(rows).map((item) => item.level);
    expect(levels.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(levels.slice(4, 8)).toEqual([2, 2, 2, 2]);
    expect(levels.slice(8)).toEqual([3, 3, 3, 3]);
  });
  it("deja sin nivel los meses sin dato", () => {
    const calendar = rainCalendar([month(1, 10), month(2, null)]);
    expect(calendar.find((item) => item.month === 2)?.level).toBeNull();
    expect(calendar.find((item) => item.month === 5)?.level).toBeNull();
  });
  it("nombra los meses más lluviosos y más secos", () => {
    expect(rainCalendarSentence(rainCalendar(rows))).toBe("Los meses con más lluvia son septiembre, octubre, noviembre y diciembre. Los meses más secos son enero, febrero, marzo y abril.");
  });
  it("no devuelve frase sin datos de lluvia", () => {
    expect(rainCalendarSentence(rainCalendar([]))).toBe("");
  });
});

describe("rotationSections / rotationSpeechItems", () => {
  it("arma las 6 secciones en orden", () => {
    expect(rotationSections(rotation(3)).map((section) => section.id)).toEqual(["why", "evidence", "benefits", "risks", "gaps", "expert"]);
  });
  it("intercala títulos grabables con los textos del análisis, sin doble punto", () => {
    const items = rotationSpeechItems(rotation(3));
    expect(items).toHaveLength(12);
    expect(items[0]).toEqual({ text: "¿Por qué?", audioId: "seccion-por-que" });
    expect(items[5]?.text).toBe("Beneficio 1. Beneficio 2.");
  });
});

describe("rotationSections con texto simple", () => {
  const plainResult: RotationResult = { ...rotation(3), plain: { why: "Simple porque.", benefits: ["Simple bueno."], risks: ["Simple riesgo."], gaps: ["Simple vacío."], validate: ["Simple técnico."] } };

  it("usa los textos simples y no muestra la lista técnica de evidencia", () => {
    const sections = rotationSections(plainResult);
    expect(sections.find((section) => section.id === "why")?.texts).toEqual(["Simple porque."]);
    expect(sections.find((section) => section.id === "risks")?.texts).toEqual(["Simple riesgo."]);
    expect(sections.find((section) => section.id === "evidence")?.texts).toEqual([NASA_DATA_TEXT]);
    expect(JSON.stringify(sections)).not.toContain("Dato A");
  });
  it("la frase fija de datos NASA es grabable", () => {
    const items = rotationSpeechItems(plainResult);
    expect(items.find((item) => item.text === NASA_DATA_TEXT)?.audioId).toBe(NASA_DATA_AUDIO_ID);
  });
  it("sin texto simple cae a los técnicos", () => {
    const sections = rotationSections(rotation(3));
    expect(sections.find((section) => section.id === "evidence")?.texts).toEqual(["Dato A"]);
    expect(sections.find((section) => section.id === "why")?.texts).toEqual(["Porque sí."]);
  });
});
