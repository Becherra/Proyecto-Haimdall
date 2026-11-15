import { describe, expect, it } from "vitest";
import { MAX_SEASON_DROPS, NASA_DATA_AUDIO_ID, NASA_DATA_TEXT, NORMAL_SEASON_DROPS, SCENARIO_PRESETS, activeScenarioPreset, bestRotationIndex, climateTopicSpeechItems, cropLink, currentSeasonSpeechItems, describeClimate, describeCurrentSeason, describeNasaSupport, describeSimpleSources, rainCalendar, rainCalendarSentence, rotationSections, rotationSpeechItems, starFills, starsLabel, compareScores } from "../src/lib/ui/resultsCopy";
import { waterShortMonths } from "../src/lib/ui/monthlyClimateSummary";
import type { CurrentSeason, Indicators, MonthlyClimate, RotationResult } from "../src/types";

const indicators: Indicators = { waterDeficitMm: -120.4, heatStressDays: 0, frostRiskDays: 3, extremeRainThresholdMm: 17.4, meanRootZoneWetness: 0.8, meanTemperatureC: 22.34, missingByParameter: {} };
const rotation = (score: number, id = "x"): RotationResult => ({ rotation: { id, name: id, cropIds: ["maiz"], description: "d" }, score, whySuggested: "Porque sí.", evidence: ["Dato A"], benefits: ["Beneficio 1", "Beneficio 2."], informationGaps: ["Vacío"], risks: ["Riesgo"], validateWithLocalExpert: ["Validar"] });
const month = (m: number, mm: number | null): MonthlyClimate => ({ year: 2020, month: m, meanTemperatureC: 20, precipitationMm: mm, evaporationMm: 1, rootZoneWetness: 0.5, missingByParameter: {} });

describe("starFills y starsLabel", () => {
  it("reparte el puntaje en medias estrellas y lo limita de 0 a 5", () => {
    expect(starFills(1.95)).toEqual([1, 1, 0, 0, 0]);
    expect(starFills(2.63)).toEqual([1, 1, 0.5, 0, 0]);
    expect(starFills(4.6)).toEqual([1, 1, 1, 1, 0.5]);
    expect(starFills(4.8)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(9)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(-2)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(Number.NaN)).toEqual([0, 0, 0, 0, 0]);
  });

  it("una diferencia chica ya no cambia una estrella entera: 2,49 y 2,51 se ven casi igual", () => {
    expect(starFills(2.49)).toEqual(starFills(2.51));
    expect(starFills(2.2)).not.toEqual(starFills(2.7));
  });

  it("el texto para lectores de pantalla dice las medias estrellas", () => {
    expect(starsLabel(2.63)).toBe("2,5 de 5");
    expect(starsLabel(5)).toBe("5 de 5");
    expect(starsLabel(Number.NaN)).toBe("0 de 5");
  });
});

describe("compareScores", () => {
  it("dice mejor, peor o igual solo si la diferencia importa (0,25 puntos o más)", () => {
    expect(compareScores(2.7, 2)).toBe("better");
    expect(compareScores(2, 2.7)).toBe("worse");
    expect(compareScores(2.6, 2.5)).toBe("same");
    expect(compareScores(2.74, 2.5)).toBe("same");
    expect(compareScores(2.75, 2.5)).toBe("better");
  });

  it("no depende de dónde caiga el redondeo de las estrellas", () => {
    expect(compareScores(2.51, 2.49)).toBe("same");
    expect(compareScores(2.49, 2.51)).toBe("same");
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
    expect(topics.find((topic) => topic.id === "roots")?.yourZone).toContain("húmeda");
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

  it("dice con palabras de campo si ha llovido menos, igual o más que de costumbre, sin usar milímetros ni porcentajes", () => {
    expect(describeCurrentSeason(season({ status: "much-drier" })).headline).toBe("En estos últimos meses casi no ha llovido. La tierra está mucho más seca que en años normales.");
    expect(describeCurrentSeason(season({ status: "drier" })).headline).toBe("En estos últimos meses ha llovido menos que en otros años para esta misma época.");
    expect(describeCurrentSeason(season({ status: "normal" })).headline).toBe("En estos últimos meses ha llovido lo que suele llover todos los años en esta época.");
    expect(describeCurrentSeason(season({ status: "wetter" })).headline).toBe("En estos últimos meses ha caído más agua que en otros años para esta época.");
    expect(describeCurrentSeason(season({ status: "much-wetter" })).headline).toBe("En estos últimos meses ha caído mucha más agua que de costumbre. La tierra está bien mojada.");
  });

  it("habla del calor o fresco sin grados numéricos y no inventa si falta el dato", () => {
    const sentenceFor = (temperatureAnomalyC: number | null) => describeCurrentSeason(season({ temperatureAnomalyC })).details.join(" ");
    expect(sentenceFor(1.4)).toContain("más calientes y bochornosos que de costumbre");
    expect(sentenceFor(-0.8)).toContain("más frescos que de costumbre");
    expect(sentenceFor(0.2)).toContain("El calor y el fresco han estado normales");
    expect(sentenceFor(null)).not.toContain("calientes");
    expect(sentenceFor(null)).not.toContain("frescos");
  });

  it("avisa de los días seguidos sin aguacero y da un consejo práctico para el lote según el clima", () => {
    expect(describeCurrentSeason(season({ currentDryStreakDays: 12 })).details.join(" ")).toContain("varios días seguidos sin que caiga un buen aguacero");
    expect(describeCurrentSeason(season({ currentDryStreakDays: 3 })).details.join(" ")).not.toContain("aguacero");
    expect(describeCurrentSeason(season({ status: "much-drier" })).details.join(" ")).toContain("Qué vigilar: revisa la humedad del suelo");
    expect(describeCurrentSeason(season({ status: "normal" })).details.join(" ")).toContain("la lluvia normal no garantiza humedad suficiente");
    expect(describeCurrentSeason(season({ status: "much-wetter" })).details.join(" ")).toContain("observa charcos, escorrentía y manchas en las hojas");
  });

  it("aclara hasta qué fecha se miraron las lluvias y que no adivina si mañana va a llover", () => {
    const { note } = describeCurrentSeason(season());
    expect(note).toContain("12 de noviembre");
    expect(note).toContain("no adivina si mañana va a llover");
  });

  it("compara con gotas de agua: 3 gotas para lo normal y de 1 a 5 gotas según qué tan seca o lluviosa va la temporada", () => {
    const dropsOf = (status: CurrentSeason["status"]) => { const card = describeCurrentSeason(season({ status })); return [card.normalDrops, card.currentDrops]; };
    expect(dropsOf("much-drier")).toEqual([NORMAL_SEASON_DROPS, 1]);
    expect(dropsOf("drier")).toEqual([NORMAL_SEASON_DROPS, 2]);
    expect(dropsOf("normal")).toEqual([NORMAL_SEASON_DROPS, 3]);
    expect(dropsOf("wetter")).toEqual([NORMAL_SEASON_DROPS, 4]);
    expect(dropsOf("much-wetter")).toEqual([NORMAL_SEASON_DROPS, MAX_SEASON_DROPS]);
  });

  it("sin porcentaje (lo normal es 0 mm) no inventa gotas normales", () => {
    const card = describeCurrentSeason(season({ rainPercentOfNormal: null, normalRainMm: 0, rainMm: 0, status: "normal" }));
    expect(card.normalDrops).toBe(0);
    expect(card.currentDrops).toBe(0);
    expect(describeCurrentSeason(season({ rainPercentOfNormal: null, normalRainMm: 0, rainMm: 12, status: "much-wetter" })).currentDrops).toBe(MAX_SEASON_DROPS);
  });

  it("para leer en voz alta: la explicación fija (grabable) y luego lo que pasa en el campo, sin milímetros", () => {
    const [fixed, data] = currentSeasonSpeechItems(describeCurrentSeason(season({ status: "drier", currentDryStreakDays: 12 })));
    expect(fixed.audioId).toBe("clima-temporada");
    expect(fixed.text).toContain("¿Cómo va esta temporada?");
    expect(data.audioId).toBeUndefined();
    expect(data.text).toContain("Más seca de lo normal");
    expect(data.text).toContain("ha llovido menos que en otros años");
    expect(data.text).toContain("Qué vigilar:");
    expect(data.text).toContain("no adivina si mañana va a llover");
    expect(data.text).not.toContain("milímetros");
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

describe("activeScenarioPreset y describeNasaSupport: simulador simple y respaldo sin jerga", () => {
  it("reconoce cuál botón de clima está activo o vuelve al clima normal por defecto", () => {
    expect(activeScenarioPreset(undefined).id).toBe("normal");
    expect(activeScenarioPreset({ tempDeltaC: 0, rainFactor: 1 }).id).toBe("normal");
    for (const preset of SCENARIO_PRESETS) {
      expect(activeScenarioPreset(preset.scenario).id).toBe(preset.id);
    }
  });

  it("traduce la sequía histórica, el peor año y la loma del lote a frases de campo sin siglas raras", () => {
    const items = describeNasaSupport({
      indicators: { ...indicators, longestDrySpellDays: 22, worstYear: { year: 2015, waterBalanceMm: -40 }, slopePercent: 25, siteElevationMeters: 1850 },
    });
    expect(items.map((item) => item.id)).toEqual(["history", "drought", "worstYear", "terrain"]);
    expect(items.find((item) => item.id === "drought")?.body).toContain("varias semanas seguidas sin un buen aguacero");
    expect(items.find((item) => item.id === "worstYear")?.title).toContain("2015");
    expect(items.find((item) => item.id === "terrain")?.body).toContain("loma fuerte");
  });

  it("omite tarjetas opcionales si no hay datos de racha seca, peor año ni terreno, y adapta pendientes suaves", () => {
    const minimal = describeNasaSupport({ indicators });
    expect(minimal.map((item) => item.id)).toEqual(["history"]);
    const gentle = describeNasaSupport({ indicators: { ...indicators, longestDrySpellDays: 8, slopePercent: 4 } });
    expect(gentle.find((item) => item.id === "drought")?.body).toContain("no suelen pasar demasiados días");
    expect(gentle.find((item) => item.id === "terrain")?.body).toContain("bastante parejo");
  });

  it("explica las fuentes reales de la NASA con palabras sencillas y sin siglas", () => {
    const source = (id: string, name: string) => ({ id, name, provider: "NASA POWER", use: "Uso técnico" });
    const sources = describeSimpleSources([
      source("power-t2m", "Temperatura media a 2 m (T2M)"), source("power-t2m_min", "Temperatura mínima a 2 m (T2M_MIN)"), source("power-t2m_max", "Temperatura máxima a 2 m (T2M_MAX)"),
      source("power-prectotcorr", "Precipitación corregida (PRECTOTCORR)"), source("power-evland", "Evaporación terrestre (EVLAND)"), source("power-gwetroot", "Humedad de la zona de raíces (GWETROOT)"),
      source("power-allsky_sfc_sw_dwn", "Radiación solar en superficie (ALLSKY_SFC_SW_DWN)"), source("power-recent", "Clima de los últimos días"),
      source("power-cell-elevation", "Altitud media de la celda"), source("terrain-srtm", "Altitud y pendiente del punto piloto más cercano"), source("crops-catalog", "Catálogo de cultivos (data/crops.json)"),
    ]);
    expect(sources.map((item) => item.id)).toEqual(["temperature", "rain", "evaporation", "roots", "recent", "terrain", "crops"]);
    expect(sources.map((item) => `${item.title} ${item.body}`).join(" ")).not.toMatch(/T2M|PRECTOTCORR|EVLAND|GWETROOT|ALLSKY|SRTM|\.json/);
  });

  it("usa la tarjeta de terreno declarado y conserva el nombre de una fuente desconocida", () => {
    const sources = describeSimpleSources([
      { id: "terrain-user", name: "Altitud y pendiente del lote", provider: "Agricultor", use: "Ajuste por altitud" },
      { id: "otra-fuente", name: "Fuente nueva", provider: "X", use: "Uso nuevo" },
    ]);
    expect(sources.map((item) => item.id)).toEqual(["terrainUser", "otra-fuente"]);
    expect(sources[1]).toMatchObject({ title: "Fuente nueva", body: "Uso nuevo" });
    expect(describeSimpleSources()).toEqual([]);
  });
});

/** Serie sintética: `years` años con 12 meses; la lluvia sale de `rain(año, mes)` y la evaporación potencial es siempre 100 mm. */
function seriesWith(years: number, rain: (yearIndex: number, month: number) => number | null): MonthlyClimate[] {
  return Array.from({ length: years * 12 }, (_, index) => {
    const yearIndex = Math.floor(index / 12);
    const monthNumber = (index % 12) + 1;
    return { year: 2011 + yearIndex, month: monthNumber, meanTemperatureC: 20, precipitationMm: rain(yearIndex, monthNumber), evaporationMm: 60, potentialEvaporationMm: 100, rootZoneWetness: 0.5, missingByParameter: {} };
  });
}
/** Enero seco en 6 de 15 años (40 %), marzo en 9 de 15 (60 %), julio en 4 de 15 (27 %): los demás meses siempre alcanza. */
const mixed = seriesWith(15, (year, m) => (m === 1 && year < 6) || (m === 3 && year < 9) || (m === 7 && year < 4) ? 50 : 150);

describe("waterShortMonths", () => {
  it("lista los meses en que falta agua en al menos 1 de cada 3 años, aunque el promedio alcance", () => {
    expect(waterShortMonths(mixed)).toEqual([1, 3]);
  });

  it("devuelve una lista vacía si en ningún mes falta agua con frecuencia", () => {
    expect(waterShortMonths(seriesWith(15, () => 150))).toEqual([]);
  });

  it("devuelve null si la serie es muy corta para hablar de frecuencia", () => {
    expect(waterShortMonths(seriesWith(3, () => 50))).toBeNull();
    expect(waterShortMonths([])).toBeNull();
  });

  it("no cuenta los meses sin dato de lluvia", () => {
    expect(waterShortMonths(seriesWith(15, (year, m) => (m === 5 ? null : 150)))).toEqual([]);
  });

  it("usa la evaporación de NASA si la serie no trae la potencial estimada", () => {
    const rows = seriesWith(15, (year, m) => (m === 2 ? 40 : 150)).map((row) => { const copy = { ...row }; delete copy.potentialEvaporationMm; return copy; });
    expect(waterShortMonths(rows)).toEqual([2]);
  });
});

describe("describeClimate con los meses de la serie", () => {
  const withMonths = (override: Partial<Indicators> = {}, rows = mixed) => describeClimate({ ...indicators, waterDeficitMm: 60, heatStressDays: 0, frostRiskDays: 0, ...override }, rows);
  const zone = (topics: ReturnType<typeof describeClimate>, id: string) => topics.find((topic) => topic.id === id)?.yourZone ?? "";

  it("agua: aunque el promedio alcance, nombra los meses con falta frecuente", () => {
    const text = zone(withMonths(), "water");
    expect(text).toContain("En promedio la lluvia alcanza");
    expect(text).toContain("enero y marzo");
    expect(text).toContain("1 de cada 3 años");
    expect(text).not.toContain("julio");
  });

  it("agua: si no falta nunca con frecuencia lo dice con confianza, y si el balance es negativo lo dice primero", () => {
    expect(zone(withMonths({}, seriesWith(15, () => 150)), "water")).toContain("también en los meses más secos");
    const deficit = zone(withMonths({ waterDeficitMm: -30 }), "water");
    expect(deficit).toContain("puede faltar agua");
    expect(deficit).toContain("Sobre todo en enero y marzo");
  });

  it("agua: si falta en los 12 meses no los lista uno por uno", () => {
    const text = zone(withMonths({ waterDeficitMm: -80 }, seriesWith(15, () => 20)), "water");
    expect(text).toBe("Aquí se pierde más agua de la que cae: puede faltar agua. Y falta durante todo el año.");
  });

  it("agua: con una serie corta no promete nada de los meses secos y usa la frase de antes", () => {
    expect(zone(withMonths({}, seriesWith(3, () => 150)), "water")).toBe("Aquí la lluvia alcanza: cae más agua de la que se pierde.");
  });

  it("calor y helada: dicen el umbral y los días por año, no solo el total de la serie", () => {
    expect(zone(withMonths({ heatStressDays: 45 }), "heat")).toBe("Hubo cerca de 3 días al año de calor fuerte (más de 35 °C): 45 en 15 años.");
    expect(zone(withMonths({ frostRiskDays: 3 }), "frost")).toBe("Hubo menos de 1 día al año con riesgo de helada (menos de 0 °C): 3 en 15 años.");
    expect(zone(withMonths({ frostRiskDays: 15 }), "frost")).toContain("cerca de 1 día al año");
  });

  it("calor y helada: con cero días igual dicen cuál era el umbral", () => {
    expect(zone(withMonths(), "heat")).toContain("más de 35 °C");
    expect(zone(withMonths(), "frost")).toContain("menos de 0 °C");
  });

  it("sin la serie mensual conservan la frase con el total, ahora con el umbral", () => {
    expect(zone(describeClimate({ ...indicators, heatStressDays: 4 }), "heat")).toBe("Hubo 4 días de calor fuerte (más de 35 °C) en los años analizados.");
    expect(zone(describeClimate({ ...indicators, frostRiskDays: 3 }), "frost")).toBe("Hubo 3 días con riesgo de helada (menos de 0 °C) en los años analizados.");
  });

  it("humedad de raíces: es un índice de 0 a 1, no un porcentaje de agua", () => {
    const wet = zone(describeClimate({ ...indicators, meanRootZoneWetness: 0.8 }), "roots");
    expect(wet).toContain("suele estar húmeda");
    expect(wet).toContain("0,8 de 1");
    expect(wet).not.toContain("por ciento");
    expect(zone(describeClimate({ ...indicators, meanRootZoneWetness: 0.6 }), "roots")).toContain("humedad media");
    expect(zone(describeClimate({ ...indicators, meanRootZoneWetness: 0.3 }), "roots")).toContain("bastante seca");
  });
});
