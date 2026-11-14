import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearClimateCache, fetchDailyClimate } from "../src/lib/nasaPower";

const fixture = JSON.parse(readFileSync("tests/fixtures/power-pereira.json", "utf8")) as unknown;
const request = { lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022 };

describe("fetchDailyClimate", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("normaliza la fixture real de Pereira y conserva los siete parámetros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const result = await fetchDailyClimate(request);
    expect(result.records.length).toBeGreaterThan(1000);
    expect(result.records[0]).toMatchObject({ date: "20200101", T2M: 16.62 });
    expect(result.missingByParameter).toEqual({ T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 });
  });

  it("convierte -999 en null y cuenta faltantes", async () => {
    const missing = { properties: { parameter: { T2M: { "20200101": -999 }, T2M_MIN: {}, T2M_MAX: {}, PRECTOTCORR: {}, EVLAND: {}, GWETROOT: {}, ALLSKY_SFC_SW_DWN: {} } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(missing), { status: 200 })));
    const result = await fetchDailyClimate(request);
    expect(result.records).toEqual([{ date: "20200101", T2M: null, T2M_MIN: null, T2M_MAX: null, PRECTOTCORR: null, EVLAND: null, GWETROOT: null, ALLSKY_SFC_SW_DWN: null }]);
    expect(result.missingByParameter.T2M).toBe(1);
  });

  it("devuelve una colección vacía cuando NASA no tiene días", async () => {
    const empty = { properties: { parameter: { T2M: {}, T2M_MIN: {}, T2M_MAX: {}, PRECTOTCORR: {}, EVLAND: {}, GWETROOT: {}, ALLSKY_SFC_SW_DWN: {} } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(empty), { status: 200 })));
    const result = await fetchDailyClimate(request);
    expect(result.records).toEqual([]);
    expect(Object.values(result.missingByParameter).every((count) => count === 0)).toBe(true);
  });

  it("rechaza respuestas malformadas y errores HTTP con mensajes claros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 })));
    await expect(fetchDailyClimate(request)).rejects.toThrow("respuesta malformada");
    clearClimateCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchDailyClimate({ ...request, lat: 0, lon: 0 })).rejects.toThrow("HTTP 503");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("usa la muestra de Pereira cuando se agotan los reintentos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await fetchDailyClimate(request);
    expect(result.source).toBe("sample");
    expect(result.records.length).toBeGreaterThan(1000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rechaza años fuera del periodo disponible y rangos mayores a 15 años", () => {
    expect(() => fetchDailyClimate({ ...request, startYear: 1980 })).toThrow("1981");
    expect(() => fetchDailyClimate({ ...request, startYear: 1981, endYear: 1996 })).toThrow("15 años");
  });
});
