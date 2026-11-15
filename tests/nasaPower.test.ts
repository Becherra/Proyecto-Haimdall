import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIMATE_CACHE } from "../src/lib/config";
import { clearClimateCache, fetchDailyClimate, fetchRecentClimate, InvalidClimateRequestError, snapToPowerCell } from "../src/lib/nasaPower";

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

describe("respaldo precargado", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("cubre los 15 años 2011–2025 completos y sin días faltantes cuando NASA POWER no responde", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const result = await fetchDailyClimate({ lat: 4.8133, lon: -75.6961, startYear: 2011, endYear: 2025 });
    expect(result.source).toBe("sample");
    expect(result.records).toHaveLength(5479);
    expect(result.records[0].date).toBe("20110101");
    expect(result.records.at(-1)?.date).toBe("20251231");
    expect(Object.values(result.missingByParameter).every((count) => count === 0)).toBe(true);
  });
});

describe("fetchRecentClimate", () => {
  const NOW = new Date("2026-11-15T12:00:00Z");
  const payload = (dates: Record<string, number>) => ({ properties: { parameter: Object.fromEntries(["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "EVLAND", "GWETROOT", "ALLSKY_SFC_SW_DWN"].map((name) => [name, dates])) } });
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("pide los últimos días hasta hoy con fechas completas, sin filtrar por año", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({ "20261112": 4.2 })), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, NOW);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("start")).toBe("20261106");
    expect(url.searchParams.get("end")).toBe("20261115");
    expect(url.searchParams.get("community")).toBe("AG");
    expect(result.records).toEqual([{ date: "20261112", T2M: 4.2, T2M_MIN: 4.2, T2M_MAX: 4.2, PRECTOTCORR: 4.2, EVLAND: 4.2, GWETROOT: 4.2, ALLSKY_SFC_SW_DWN: 4.2 }]);
  });

  it("convierte -999 de los días que NASA aún no publica en dato faltante", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({ "20261113": -999 })), { status: 200 })));
    const result = await fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, NOW);
    expect(result.records[0].PRECTOTCORR).toBeNull();
    expect(result.missingByParameter.PRECTOTCORR).toBe(1);
  });

  it("no repite la llamada idéntica el mismo día", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload({ "20261112": 1 })), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, NOW);
    const again = await fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, NOW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.source).toBe("cache");
  });

  it("rechaza ventanas fuera de rango o coordenadas inválidas, igual que fetchDailyClimate", () => {
    for (const days of [0, 91, 2.5]) expect(() => fetchRecentClimate({ lat: 4.8, lon: -75.7, days }, NOW)).toThrow(InvalidClimateRequestError);
    expect(() => fetchRecentClimate({ lat: 95, lon: -75.7, days: 30 }, NOW)).toThrow(InvalidClimateRequestError);
  });

  it("no usa la muestra precargada como respaldo: si NASA falla, falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, NOW)).rejects.toThrow("HTTP 503");
  });
});

describe("celda de NASA POWER", () => {
  it("lleva cualquier punto al centro de su celda de 0,5° × 0,625°", () => {
    expect(snapToPowerCell(4.8133, -75.6961)).toEqual({ lat: 5, lon: -75.625 });
    expect(snapToPowerCell(5.0689, -75.5174)).toEqual({ lat: 5, lon: -75.625 });
    expect(snapToPowerCell(4.5339, -75.6811)).toEqual({ lat: 4.5, lon: -75.625 });
    expect(snapToPowerCell(-33.9, 18.4)).toEqual({ lat: -34, lon: 18.125 });
  });

  it("no se sale de los límites en los polos ni en el antimeridiano", () => {
    expect(snapToPowerCell(90, 0)).toEqual({ lat: 90, lon: 0 });
    expect(snapToPowerCell(-90, -180)).toEqual({ lat: -90, lon: -180 });
    expect(snapToPowerCell(10, 180)).toEqual({ lat: 10, lon: -180 });
    expect(snapToPowerCell(10, 179.9)).toEqual({ lat: 10, lon: -180 });
  });
});

describe("caché del clima", () => {
  const sevenParameters = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it("dos puntos de la misma celda comparten una sola consulta a NASA, hecha al centro de la celda", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sevenParameters(fixture));
    vi.stubGlobal("fetch", fetchMock);
    const pereira = await fetchDailyClimate(request);
    const manizales = await fetchDailyClimate({ ...request, lat: 5.0689, lon: -75.5174 });
    const nearby = await fetchDailyClimate({ ...request, lat: 4.81331, lon: -75.69611 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect([url.searchParams.get("latitude"), url.searchParams.get("longitude")]).toEqual(["5", "-75.625"]);
    expect([pereira.source, manizales.source, nearby.source]).toEqual(["live", "cache", "cache"]);
  });

  it("celdas distintas hacen consultas distintas", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sevenParameters(fixture));
    vi.stubGlobal("fetch", fetchMock);
    await fetchDailyClimate(request);
    await fetchDailyClimate({ ...request, lat: 4.5339, lon: -75.6811 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("una respuesta en vivo vence después del tiempo de vida y se vuelve a pedir", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    const fetchMock = vi.fn().mockImplementation(async () => sevenParameters(fixture));
    vi.stubGlobal("fetch", fetchMock);
    await fetchDailyClimate(request);
    vi.setSystemTime(Date.now() + CLIMATE_CACHE.historicalTtlMs - 1);
    await fetchDailyClimate(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1);
    await fetchDailyClimate(request);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("la muestra guardada sigue rotulada como muestra en las consultas siguientes, no como caché", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const first = await fetchDailyClimate(request);
    const second = await fetchDailyClimate(request);
    expect(first.source).toBe("sample");
    expect(second.source).toBe("sample");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("vuelve a intentar con NASA cuando pasa la ventana corta del respaldo", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await fetchDailyClimate(request)).source).toBe("sample");
    vi.setSystemTime(Date.now() + CLIMATE_CACHE.fallbackTtlMs);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => sevenParameters(fixture)));
    expect((await fetchDailyClimate(request)).source).toBe("live");
  });

  it("el clima reciente vence a las horas, no a los días", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-11-15T12:00:00Z");
    vi.setSystemTime(now);
    const fetchMock = vi.fn().mockImplementation(async () => sevenParameters({ properties: { parameter: Object.fromEntries(["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "EVLAND", "GWETROOT", "ALLSKY_SFC_SW_DWN"].map((name) => [name, { "20261112": 1 }])) } }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, now);
    vi.setSystemTime(Date.now() + CLIMATE_CACHE.recentTtlMs);
    await fetchRecentClimate({ lat: 4.8133, lon: -75.6961, days: 10 }, now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("límite de uso de NASA POWER (HTTP 429)", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("usa la muestra precargada sin reintentar cuando NASA limita las consultas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchDailyClimate(request);
    expect(result.source).toBe("sample");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sin muestra para el sitio falla con un mensaje claro y tampoco reintenta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchDailyClimate({ ...request, lat: 6.25, lon: -75.56 })).rejects.toThrow("HTTP 429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("otros errores 4xx siguen siendo errores: no se esconden detrás de la muestra", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 422 })));
    await expect(fetchDailyClimate(request)).rejects.toThrow("HTTP 422");
  });
});
