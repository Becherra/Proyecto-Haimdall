import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { listDataSources } from "../src/lib/dataSources";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";
import { TERRAIN_SAMPLES, resolveTerrain } from "../src/lib/terrain";
import type { LiveTerrain } from "../src/lib/terrainGrid";
import { describeNasaSupport, describeSimpleSources } from "../src/lib/ui/resultsCopy";
import type { Indicators, UserPriorities } from "../src/types";

const powerFixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const BOGOTA = { lat: 4.711, lon: -74.072 }; // fuera de los 5 puntos piloto de SRTM
const PEREIRA = { lat: 4.8133, lon: -75.6961 };
const LIVE: LiveTerrain = { elevationMeters: 2600, slopePercent: 22, slopeRangePercent: [5, 40], cellMeters: 30 };

describe("resolveTerrain con una medición en vivo", () => {
  it("usa la medición y la marca como srtm-live, con su rango y el tamaño de celda", () => {
    expect(resolveTerrain(BOGOTA, undefined, true, TERRAIN_SAMPLES, LIVE)).toEqual({
      elevationMeters: 2600, slopePercent: 22, source: "srtm-live", slopeRangePercent: [5, 40], cellMeters: 30,
    });
  });

  it("gana a la muestra precargada cuando el sitio tiene las dos", () => {
    expect(resolveTerrain(PEREIRA, undefined, true, TERRAIN_SAMPLES, LIVE)).toMatchObject({ elevationMeters: 2600, source: "srtm-live" });
  });

  it("sin medición sigue usando la muestra precargada", () => {
    expect(resolveTerrain(PEREIRA, undefined, true, TERRAIN_SAMPLES, null)).toMatchObject({ elevationMeters: 1413, source: "srtm-sample" });
  });

  it("respeta la misma puerta que la muestra: sin altitud de la celda de NASA no se usa", () => {
    expect(resolveTerrain(BOGOTA, undefined, false, TERRAIN_SAMPLES, LIVE)).toBeNull();
  });

  it("lo que declara el agricultor manda y la medición completa lo que falta, sin arrastrar el rango", () => {
    const resolved = resolveTerrain(BOGOTA, { slopePercent: 5 }, true, TERRAIN_SAMPLES, LIVE);
    expect(resolved).toEqual({ elevationMeters: 2600, slopePercent: 5, source: "user" });
  });
});

describe("buildAnalysis con terreno medido en vivo", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  async function analyse(liveTerrain: LiveTerrain | null, location = BOGOTA) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(powerFixture, { status: 200 })));
    const climate = await fetchDailyClimate({ ...PEREIRA, startYear: 2020, endYear: 2022 });
    return buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location, liveTerrain });
  }

  it("corrige la temperatura a la altitud medida aunque el sitio no esté en los puntos piloto", async () => {
    const without = await analyse(null);
    const withLive = await analyse(LIVE);
    expect(without.indicators.siteElevationMeters).toBeUndefined();
    expect(without.indicators.meanTemperatureC).toBeCloseTo(without.indicators.cellMeanTemperatureC ?? without.indicators.meanTemperatureC!, 5);
    expect(withLive.indicators).toMatchObject({ siteElevationMeters: 2600, slopePercent: 22, terrainSource: "srtm-live", slopeRangePercent: [5, 40], terrainCellMeters: 30 });
    // 2600 m queda ~462 m por encima de la celda (2138 m): ~2,8 °C más fría.
    expect(withLive.indicators.meanTemperatureC!).toBeLessThan(without.indicators.meanTemperatureC! - 2.5);
  });

  it("dice en la evidencia y en los vacíos que se midió en vivo, el rango y que no es una certeza", async () => {
    const analysis = await analyse(LIVE);
    for (const result of analysis.rotations) {
      const evidence = result.evidence.join(" ");
      expect(evidence).toContain("NASA SRTM, medida en vivo");
      expect(evidence).toContain("entre 5 % y 40 %");
      expect(evidence).toContain("altitud medida en vivo con NASA SRTM");
      expect(evidence).not.toContain("punto piloto más cercano");
      expect(result.informationGaps.join(" ")).toContain("se midieron en vivo con NASA SRTM");
      expect(result.informationGaps.join(" ")).not.toContain("punto piloto más cercano");
      expect(result.plain?.gaps.join(" ")).toContain("midió un satélite de la NASA en tu terreno");
    }
  });

  it("avisa cuando el lote es grande y la pendiente se midió con celdas más gruesas", async () => {
    const analysis = await analyse({ ...LIVE, cellMeters: 140 });
    for (const result of analysis.rotations) {
      expect(result.informationGaps.join(" ")).toContain("El lote es grande");
      expect(result.informationGaps.join(" ")).toContain("celdas de 140 m");
    }
    const small = await analyse(LIVE);
    for (const result of small.rotations) expect(result.informationGaps.join(" ")).not.toContain("El lote es grande");
  });

  it("agrega la fuente terrain-srtm-live a la lista de datos usados", async () => {
    const analysis = await analyse(LIVE);
    const ids = analysis.dataSources?.map(({ id }) => id) ?? [];
    expect(ids).toContain("terrain-srtm-live");
    expect(ids).not.toContain("terrain-srtm");
    expect(analysis.dataSources?.find(({ id }) => id === "terrain-srtm-live")).toMatchObject({ provider: expect.stringContaining("SRTMGL1") });
  });

  it("una ladera empinada medida en vivo pesa en el puntaje igual que una declarada", async () => {
    const steep = await analyse({ ...LIVE, slopePercent: 40 });
    const flat = await analyse({ ...LIVE, slopePercent: 2 });
    expect(steep.rotations.some((result) => result.risks.join(" ").includes("Lote en ladera"))).toBe(true);
    expect(flat.rotations.some((result) => result.risks.join(" ").includes("Lote en ladera"))).toBe(false);
  });
});

describe("textos del agricultor según el origen del terreno", () => {
  const base: Indicators = { waterDeficitMm: 10, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: {} };
  const terrainBody = (indicators: Partial<Indicators>) => describeNasaSupport({ indicators: { ...base, ...indicators } }).find((item) => item.id === "terrain")?.body ?? "";

  it("si la pendiente se midió en tu lote lo dice; si es de un punto de referencia, también", () => {
    expect(terrainBody({ slopePercent: 12, terrainSource: "srtm-live" })).toContain("Con datos de la NASA medimos que tu terreno tiene algo de falda");
    expect(terrainBody({ slopePercent: 12, terrainSource: "srtm-sample" })).toContain("Cerca de tu finca, en un punto de referencia de tu zona");
    expect(terrainBody({ slopePercent: 12, terrainSource: "user" })).toContain("Según lo que nos contaste");
  });

  it("conserva las tres franjas de pendiente con cualquier origen", () => {
    for (const terrainSource of ["srtm-live", "srtm-sample", "user"] as const) {
      expect(terrainBody({ slopePercent: 25, terrainSource })).toContain("loma fuerte");
      expect(terrainBody({ slopePercent: 12, terrainSource })).toContain("atravesado a la loma");
      expect(terrainBody({ slopePercent: 3, terrainSource })).toContain("bastante parejo");
    }
  });

  it("dos lotes con pendiente distinta ya no reciben el mismo texto", () => {
    expect(terrainBody({ slopePercent: 25, terrainSource: "srtm-live" })).not.toBe(terrainBody({ slopePercent: 12, terrainSource: "srtm-live" }));
  });

  it("la fuente en vivo tiene su propia tarjeta sencilla, que no dice 'punto cercano'", () => {
    const sources = listDataSources({ ...base, cellElevationMeters: 2138, siteElevationMeters: 2600, slopePercent: 22, terrainSource: "srtm-live" });
    const cards = describeSimpleSources(sources);
    const terrain = cards.find((card) => card.id === "terrainLive");
    expect(terrain?.body).toContain("tu terreno");
    expect(terrain?.body).not.toContain("punto cercano");
    expect(cards.filter((card) => card.id === "terrain")).toHaveLength(1);
  });
});
