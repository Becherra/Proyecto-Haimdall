import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analysis/route";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { listDataSources } from "../src/lib/dataSources";
import { clearClimateCache } from "../src/lib/nasaPower";
import { analysisResponseSchema, CLIMATE_PARAMETERS, type ClimateRecord, type ClimateResult, type Indicators, type UserPriorities } from "../src/types";


// El terreno en vivo llama a otro servicio con el mismo fetch global: aquí se apaga para que estos tests solo cuenten las llamadas a NASA POWER.
vi.mock("../src/lib/terrainLive", () => ({ fetchLiveTerrain: vi.fn().mockResolvedValue(null), clearLiveTerrainCache: vi.fn() }));

const PEREIRA = { lat: 4.8133, lon: -75.6961 };
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const record = (date: string): ClimateRecord => ({ date, T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: 6, EVLAND: 3, GWETROOT: 0.7, ALLSKY_SFC_SW_DWN: 15 });
const records = Array.from({ length: 12 }, (_, month) => Array.from({ length: 28 }, (_, day) => record(`2021${String(month + 1).padStart(2, "0")}${String(day + 1).padStart(2, "0")}`))).flat();
const climate: ClimateResult = { records, source: "live", missingByParameter: { T2M: 0 }, cellElevationMeters: 2138 };

describe("buildAnalysis: respuesta liviana", () => {
  it("por defecto no envía los registros diarios, pero sí el resumen de la serie", () => {
    const response = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.climate.records).toBeUndefined();
    expect(response.climate).toMatchObject({ source: "live", missingByParameter: { T2M: 0 }, cellElevationMeters: 2138, daysAnalyzed: 336, firstDate: "20210101", lastDate: "20211228" });
  });

  it("envía los registros diarios originales cuando se piden", () => {
    const response = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA, includeDailyRecords: true });
    expect(response.climate.records).toEqual(records);
    expect(response.climate.daysAnalyzed).toBe(336);
  });

  it("toma la primera y la última fecha aunque los registros lleguen desordenados", () => {
    const shuffled = { ...climate, records: [...records].reverse() };
    expect(buildAnalysis({ climate: shuffled, crops: CROPS, priorities: EQUAL, location: PEREIRA }).climate).toMatchObject({ firstDate: "20210101", lastDate: "20211228" });
  });

  it("incluye la lista de datos usados", () => {
    const { dataSources } = buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA });
    expect(dataSources?.length).toBeGreaterThan(0);
  });
});

describe("listDataSources", () => {
  const indicators: Indicators = { waterDeficitMm: 40, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 15, meanRootZoneWetness: 0.8, missingByParameter: {} };
  const ids = (input: Indicators) => listDataSources(input).map(({ id }) => id);

  it("nombra cada parámetro de NASA POWER que se descarga, con su uso y la URL del servicio", () => {
    const sources = listDataSources(indicators);
    for (const parameter of CLIMATE_PARAMETERS) {
      const source = sources.find(({ name }) => name.includes(`(${parameter})`));
      expect(source, parameter).toBeDefined();
      expect(source?.provider).toBe("NASA POWER");
      expect(source?.url).toBe("https://power.larc.nasa.gov/");
    }
  });

  it("dice con franqueza qué datos se descargan pero no cambian el puntaje", () => {
    const sources = listDataSources(indicators);
    expect(sources.find(({ name }) => name.includes("(ALLSKY_SFC_SW_DWN)"))?.use).toContain("no cambia el puntaje");
    expect(sources.find(({ name }) => name.includes("(GWETROOT)"))?.use).toContain("no cambia el puntaje");
  });

  it("incluye el catálogo de cultivos como fuente propia y preliminar, no como dato NASA", () => {
    const catalog = listDataSources(indicators).find(({ id }) => id === "crops-catalog");
    expect(catalog?.provider).not.toContain("NASA");
    expect(catalog?.use).toContain("preliminares");
  });

  it("solo menciona la altitud de la celda y el terreno SRTM cuando se usaron", () => {
    expect(ids(indicators)).not.toContain("power-cell-elevation");
    expect(ids(indicators)).not.toContain("terrain-srtm");
    const adjusted = ids({ ...indicators, cellElevationMeters: 2138, siteElevationMeters: 1411, terrainSource: "srtm-sample" });
    expect(adjusted).toContain("power-cell-elevation");
    expect(adjusted).toContain("terrain-srtm");
  });

  it("presenta el terreno de la muestra como lectura de NASA SRTM y el declarado como dato del agricultor", () => {
    const sample = listDataSources({ ...indicators, siteElevationMeters: 1411, terrainSource: "srtm-sample" }).find(({ id }) => id === "terrain-srtm");
    expect(sample?.provider).toContain("SRTMGL1");
    expect(sample?.provider).not.toContain("sin verificar");
    expect(sample?.url).toContain("earthdata.nasa.gov");
    const declared = listDataSources({ ...indicators, siteElevationMeters: 1500, terrainSource: "user" });
    expect(declared.map(({ id }) => id)).toContain("terrain-user");
    expect(declared.map(({ id }) => id)).not.toContain("terrain-srtm");
  });
});

describe("POST /api/analysis: registros diarios", () => {
  const fixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
  const body = { ...PEREIRA, startYear: 2020, endYear: 2022, priorities: EQUAL };
  const post = (payload: unknown) => new Request("http://localhost/api/analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

  beforeEach(() => {
    clearClimateCache();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(fixture, { status: 200 })));
  });

  it("no envía registros diarios por defecto y la respuesta pesa mucho menos", async () => {
    const lean = await (await POST(post(body))).text();
    clearClimateCache();
    const full = await (await POST(post({ ...body, includeDailyRecords: true }))).text();
    expect(JSON.parse(lean).climate.records).toBeUndefined();
    expect(JSON.parse(lean).climate.daysAnalyzed).toBe(1096);
    expect(JSON.parse(full).climate.records).toHaveLength(1096);
    expect(lean.length).toBeLessThan(full.length / 3);
  });
});
