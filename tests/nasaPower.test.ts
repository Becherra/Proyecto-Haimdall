import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearClimateCache, fetchDailyClimate, InvalidClimateRequestError } from "../src/lib/nasaPower";

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

  it("usa la muestra de Manizales o de Armenia cuando NASA POWER no responde en esos sitios", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const manizales = await fetchDailyClimate({ ...request, lat: 5.0689, lon: -75.5174 });
    const armenia = await fetchDailyClimate({ ...request, lat: 4.5339, lon: -75.6811 });
    for (const result of [manizales, armenia]) {
      expect(result.source).toBe("sample");
      expect(result.records).toHaveLength(1096);
    }
    // Armenia cae en otra celda de NASA POWER: otra altitud media y otra serie de temperatura.
    expect(manizales.cellElevationMeters).toBeCloseTo(2138.33, 2);
    expect(armenia.cellElevationMeters).toBeCloseTo(2266.93, 2);
    expect(armenia.records[0].T2M).not.toBe(manizales.records[0].T2M);
  });

  it("cubre Santa Rosa de Cabal con la muestra de Pereira, que está en la misma celda de NASA POWER", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const santaRosa = await fetchDailyClimate({ ...request, lat: 4.868, lon: -75.605 });
    clearClimateCache();
    const pereira = await fetchDailyClimate(request);
    expect(santaRosa.source).toBe("sample");
    expect(santaRosa.records).toEqual(pereira.records);
  });

  it("usa la muestra de Armenia para un sitio cercano dentro de su tolerancia", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const nearArmenia = await fetchDailyClimate({ ...request, lat: 4.62, lon: -75.69 });
    expect(nearArmenia.cellElevationMeters).toBeCloseTo(2266.93, 2);
  });

  it("no inventa una muestra para un sitio sin datos precargados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchDailyClimate({ ...request, lat: 6.25, lon: -75.56 })).rejects.toThrow();
  });

  it("rechaza años fuera del periodo disponible y rangos mayores a 15 años", () => {
    expect(() => fetchDailyClimate({ ...request, startYear: 1980 })).toThrow("1981");
    expect(() => fetchDailyClimate({ ...request, startYear: 1981, endYear: 1996 })).toThrow("15 años");
  });

  it("marca las solicitudes inválidas con InvalidClimateRequestError y no las fallas del servicio", async () => {
    expect(() => fetchDailyClimate({ ...request, startYear: 1981, endYear: 1996 })).toThrow(InvalidClimateRequestError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const failure = await fetchDailyClimate(request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(InvalidClimateRequestError);
  });
});
