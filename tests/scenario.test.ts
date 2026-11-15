import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analysis/route";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { clearClimateCache } from "../src/lib/nasaPower";
import { applyScenario, describeScenario, isNeutralScenario } from "../src/lib/scenario";
import { analysisResponseSchema, type ClimateRecord, type ClimateResult, type UserPriorities } from "../src/types";

const record = (date: string, overrides: Partial<ClimateRecord> = {}): ClimateRecord => ({ date, T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: 10, EVLAND: 3, GWETROOT: 0.7, ALLSKY_SFC_SW_DWN: 15, ...overrides });

describe("applyScenario", () => {
  it("suma el cambio de temperatura a la media, la mínima y la máxima", () => {
    const [shifted] = applyScenario([record("20210101")], { tempDeltaC: 2 });
    expect(shifted).toMatchObject({ T2M: 22, T2M_MIN: 16, T2M_MAX: 29 });
  });

  it("multiplica la lluvia por el factor", () => {
    expect(applyScenario([record("20210101")], { rainFactor: 0.8 })[0].PRECTOTCORR).toBeCloseTo(8);
  });

  it("no toca los demás parámetros de NASA ni la fecha", () => {
    const [shifted] = applyScenario([record("20210101")], { tempDeltaC: 3, rainFactor: 0.5 });
    expect(shifted).toMatchObject({ date: "20210101", EVLAND: 3, GWETROOT: 0.7, ALLSKY_SFC_SW_DWN: 15 });
  });

  it("deja en null los datos faltantes: un escenario no inventa datos", () => {
    const [shifted] = applyScenario([record("20210101", { T2M_MAX: null, PRECTOTCORR: null })], { tempDeltaC: 2, rainFactor: 0.8 });
    expect(shifted.T2M_MAX).toBeNull();
    expect(shifted.PRECTOTCORR).toBeNull();
  });

  it("no modifica los registros originales", () => {
    const original = [record("20210101")];
    applyScenario(original, { tempDeltaC: 2, rainFactor: 0.8 });
    expect(original[0]).toEqual(record("20210101"));
  });

  it("con valores ausentes o neutros deja la serie igual", () => {
    expect(applyScenario([record("20210101")], {})).toEqual([record("20210101")]);
    expect(applyScenario([record("20210101")], { tempDeltaC: 0, rainFactor: 1 })).toEqual([record("20210101")]);
  });
});

describe("describeScenario e isNeutralScenario", () => {
  it("describe el escenario con signo y porcentaje", () => {
    expect(describeScenario({ tempDeltaC: 2, rainFactor: 0.8 })).toBe("+2.0 °C de temperatura y −20 % de lluvia");
    expect(describeScenario({ tempDeltaC: -1 })).toBe("−1.0 °C de temperatura");
    expect(describeScenario({ rainFactor: 1.1 })).toBe("+10 % de lluvia");
  });

  it("reconoce el escenario neutro", () => {
    expect(isNeutralScenario({})).toBe(true);
    expect(isNeutralScenario({ tempDeltaC: 0, rainFactor: 1 })).toBe(true);
    expect(isNeutralScenario({ rainFactor: 0.9 })).toBe(false);
  });
});

describe("buildAnalysis: escenarios", () => {
  const PEREIRA = { lat: 4.8133, lon: -75.6961 };
  const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
  const records = Array.from({ length: 12 }, (_, month) => Array.from({ length: 28 }, (_, day) => record(`2021${String(month + 1).padStart(2, "0")}${String(day + 1).padStart(2, "0")}`, { T2M: 22, T2M_MIN: 16, T2M_MAX: 33, PRECTOTCORR: 5 }))).flat();
  const climate: ClimateResult = { records, source: "live", missingByParameter: {} };
  const analyze = (scenario?: { tempDeltaC?: number; rainFactor?: number }) => buildAnalysis({ climate, crops: CROPS, priorities: EQUAL, location: PEREIRA, scenario });

  it("con más calor sube la temperatura media y aparecen días de estrés térmico", () => {
    const base = analyze();
    const hot = analyze({ tempDeltaC: 3 });
    expect(hot.indicators.meanTemperatureC).toBeCloseTo((base.indicators.meanTemperatureC ?? 0) + 3, 5);
    expect(base.indicators.heatStressDays).toBe(0);
    expect(hot.indicators.heatStressDays).toBe(records.length);
  });

  it("con menos lluvia empeora el balance hídrico", () => {
    expect(analyze({ rainFactor: 0.5 }).indicators.waterDeficitMm ?? 0).toBeLessThan(analyze().indicators.waterDeficitMm ?? 0);
  });

  it("devuelve el escenario aplicado y lo declara como hipotético en cada rotación", () => {
    const response = analyze({ tempDeltaC: 2, rainFactor: 0.8 });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.scenario).toEqual({ tempDeltaC: 2, rainFactor: 0.8 });
    for (const result of response.rotations) {
      const gaps = result.informationGaps.join(" ");
      expect(gaps).toContain("hipotético");
      expect(gaps).toContain("+2.0 °C");
      expect(gaps).toContain("−20 % de lluvia");
    }
  });

  it("conserva en climate los datos originales de NASA y refleja el escenario en el resumen mensual", () => {
    const response = analyze({ tempDeltaC: 2 });
    expect(response.climate.records[0].T2M).toBe(22);
    expect(response.monthlyClimate[0].meanTemperatureC).toBeCloseTo(24);
  });

  it("sin escenario, o con uno neutro, no cambia nada ni agrega el aviso", () => {
    const base = analyze();
    const neutral = analyze({ tempDeltaC: 0, rainFactor: 1 });
    expect(base.scenario).toBeUndefined();
    expect(neutral.indicators).toEqual(base.indicators);
    expect(neutral.rotations.map(({ score }) => score)).toEqual(base.rotations.map(({ score }) => score));
    for (const result of [...base.rotations, ...neutral.rotations]) expect(result.informationGaps.join(" ")).not.toContain("hipotético");
  });
});

describe("POST /api/analysis: escenarios", () => {
  const fixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
  const body = { lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022, priorities: { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 } };
  const post = (payload: unknown) => new Request("http://localhost/api/analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });

  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("aplica el escenario pedido y lo devuelve", async () => {
    // Una Response solo se puede leer una vez: cada llamada simulada a NASA POWER necesita la suya.
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(fixture, { status: 200 })));
    const base = await (await POST(post(body))).json();
    clearClimateCache();
    const response = await POST(post({ ...body, scenario: { tempDeltaC: 2, rainFactor: 0.8 } }));
    const scenario = await response.json();
    expect(response.status).toBe(200);
    expect(scenario.scenario).toEqual({ tempDeltaC: 2, rainFactor: 0.8 });
    expect(scenario.indicators.meanTemperatureC).toBeCloseTo(base.indicators.meanTemperatureC + 2, 5);
    expect(scenario.indicators.waterDeficitMm).toBeLessThan(base.indicators.waterDeficitMm);
  });

  it("devuelve 400 si el escenario está fuera de los límites", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await POST(post({ ...body, scenario: { tempDeltaC: 12 } }))).status).toBe(400);
    expect((await POST(post({ ...body, scenario: { rainFactor: 0 } }))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
