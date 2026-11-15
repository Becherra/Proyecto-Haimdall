import { describe, expect, it } from "vitest";
import { NASA_DATA_AUDIO_ID, NASA_DATA_TEXT, bestRotationIndex, climateTopicSpeechItems, cropLink, currentSeasonSpeechItems, describeClimate, describeCurrentSeason, rainCalendar, rainCalendarSentence, rotationSections, rotationSpeechItems, scoreToStars } from "../src/lib/ui/resultsCopy";
import type { CurrentSeason, Indicators, MonthlyClimate, RotationResult } from "../src/types";

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

describe("describeCurrentSeason: cómo va la temporada", () => {
  const season = (overrides: Partial<CurrentSeason> = {}): CurrentSeason => ({
    windowDays: 87, firstDate: "20260818", lastDate: "20261112", daysWithData: 87, rainMm: 563.27, normalRainMm: 507.42, rainPercentOfNormal: 111,
    status: "normal", temperatureAnomalyC: 1.4, currentDryStreakDays: 0, baselineYears: 15, ...overrides,
  });

  it("traduce cada estado a una etiqueta simple y a un tono", () => {
    const labelOf = (status: CurrentSeason["status"]) => { const card = describeCurrentSeason(season({ status })); return [card.statusLabel, card.tone]; };
    expect(labelOf("much-drier")).toEqual(["Muy seca", "dry"]);
    expect(labelOf("drier")).toEqual(["Más seca de lo normal", "dry"]);
    expect(labelOf("normal")).toEqual(["Normal", "normal"]);
    expect(labelOf("wetter")).toEqual(["Más lluviosa de lo normal", "wet"]);
    expect(labelOf("much-wetter")).toEqual(["Muy lluviosa", "wet"]);
  });

  it("dice con palabras simples si ha llovido menos, igual o más que lo normal", () => {
    expect(describeCurrentSeason(season({ status: "much-drier" })).headline).toBe("Ha llovido mucho menos de lo normal.");
    expect(describeCurrentSeason(season({ status: "drier" })).headline).toBe("Ha llovido menos de lo normal.");
    expect(describeCurrentSeason(season({ status: "normal" })).headline).toBe("Ha llovido lo normal para esta época.");
    expect(describeCurrentSeason(season({ status: "wetter" })).headline).toBe("Ha llovido más de lo normal.");
    expect(describeCurrentSeason(season({ status: "much-wetter" })).headline).toBe("Ha llovido mucho más de lo normal.");
  });

  it("cuenta cuántos milímetros cayeron en los días de la ventana y cuántos son lo normal", () => {
    expect(describeCurrentSeason(season()).amount).toBe("En los últimos 87 días cayeron 563 milímetros; lo normal en esa época son 507.");
  });

  it("habla de la temperatura solo si se aparta de lo normal y no inventa si falta el dato", () => {
    const sentenceFor = (temperatureAnomalyC: number | null) => describeCurrentSeason(season({ temperatureAnomalyC })).details.join(" ");
    expect(sentenceFor(1.4)).toContain("1,4 grados más calor de lo normal");
    expect(sentenceFor(-0.8)).toContain("0,8 grados menos calor de lo normal");
    expect(sentenceFor(0.2)).toContain("La temperatura ha sido normal");
    expect(sentenceFor(null)).not.toContain("temperatura");
    expect(sentenceFor(null)).not.toContain("calor");
  });

  it("avisa de los días seguidos casi sin lluvia solo si son varios", () => {
    expect(describeCurrentSeason(season({ currentDryStreakDays: 12 })).details.join(" ")).toContain("12 días seguidos casi sin lluvia");
    expect(describeCurrentSeason(season({ currentDryStreakDays: 3 })).details.join(" ")).not.toContain("sin lluvia");
    expect(describeCurrentSeason(season({ currentDryStreakDays: 1 })).details.join(" ")).not.toContain("seguidos");
  });

  it("aclara la fecha del dato y que es reciente y no un pronóstico", () => {
    const { note } = describeCurrentSeason(season());
    expect(note).toContain("12 de noviembre");
    expect(note).toContain("no es un pronóstico");
  });

  it("dibuja las barras de lluvia normal y reciente con la misma escala", () => {
    const low = describeCurrentSeason(season({ rainPercentOfNormal: 40 }));
    expect(low.normalBar).toBeCloseTo(66.67, 1);
    expect(low.currentBar).toBeCloseTo(26.67, 1);
    const high = describeCurrentSeason(season({ rainPercentOfNormal: 200 }));
    expect(high.currentBar).toBe(100);
    expect(high.normalBar).toBeCloseTo(50, 5);
  });

  it("sin porcentaje (lo normal es 0 mm) no inventa barras de comparación", () => {
    const card = describeCurrentSeason(season({ rainPercentOfNormal: null, normalRainMm: 0, rainMm: 0, status: "normal" }));
    expect(card.normalBar).toBe(0);
    expect(card.currentBar).toBe(0);
    expect(describeCurrentSeason(season({ rainPercentOfNormal: null, normalRainMm: 0, rainMm: 12, status: "much-wetter" })).currentBar).toBe(100);
  });

  it("para leer en voz alta: la explicación fija (grabable) y luego lo que dicen los datos", () => {
    const [fixed, data] = currentSeasonSpeechItems(describeCurrentSeason(season({ status: "drier", currentDryStreakDays: 12 })));
    expect(fixed.audioId).toBe("clima-temporada");
    expect(fixed.text).toContain("¿Cómo va esta temporada?");
    expect(data.audioId).toBeUndefined();
    expect(data.text).toContain("Ha llovido menos de lo normal");
    expect(data.text).toContain("563 milímetros");
    expect(data.text).toContain("no es un pronóstico");
  });
});

describe("cropLink: cómo se unen los cultivos de una opción", () => {
  it("una rotación se lee como relevo (flecha) y una asociación con un cultivo permanente como mezcla (+)", () => {
    expect(cropLink({ name: "Maíz → Soya" })).toBe("then");
    expect(cropLink({ name: "Maíz → Crotalaria → Yuca" })).toBe("then");
    expect(cropLink({ name: "Café + Fríjol" })).toBe("with");
    expect(cropLink({ name: "Plátano + Maíz" })).toBe("with");
  });

  it("un solo cultivo no tiene unión, y se queda en relevo por defecto", () => {
    expect(cropLink({ name: "Actual: Café (Coffea arabica)" })).toBe("then");
  });
});
