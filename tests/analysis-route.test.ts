import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analysis/route";
import { clearClimateCache } from "../src/lib/nasaPower";
import { analysisResponseSchema } from "../src/types";


// El terreno en vivo llama a otro servicio con el mismo fetch global: aquí se apaga para que estos tests solo cuenten las llamadas a NASA POWER.
vi.mock("../src/lib/terrainLive", () => ({ fetchLiveTerrain: vi.fn().mockResolvedValue(null), clearLiveTerrainCache: vi.fn() }));

const fixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
const priorities = { waterSaving: 4, extraIncome: 2, soilImprovement: 3, erosionReduction: 3, lowRisk: 2 };
const pereira = { lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022, priorities };

function post(body: unknown): Request {
  return new Request("http://localhost/api/analysis", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

describe("POST /api/analysis", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("devuelve 200 con clima, indicadores y 3 rotaciones válidas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })));
    const response = await POST(post(pereira));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(analysisResponseSchema.safeParse(body).success).toBe(true);
    expect(body.climate.source).toBe("live");
    expect(body.rotations).toHaveLength(3);
  });

  it("pide también los últimos días y avisa cuando la serie trae menos años de los pedidos", async () => {
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(new Response(fixture, { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    const body = await (await POST(post({ ...pereira, startYear: 2011, endYear: 2025 }))).json();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const recentUrl = new URL(String(fetchSpy.mock.calls[1]?.[0]));
    expect(Number(recentUrl.searchParams.get("end"))).toBeGreaterThan(Number(recentUrl.searchParams.get("start")));
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).toContain("Se pidieron 15 años de clima y la serie trae 3");
  });

  it("sigue sin la temporada actual y lo dice si NASA POWER no entrega los últimos días", async () => {
    const fetchSpy = vi.fn().mockImplementationOnce(() => Promise.resolve(new Response(fixture, { status: 200 }))).mockImplementation(() => Promise.resolve(new Response("", { status: 503 })));
    vi.stubGlobal("fetch", fetchSpy);
    const response = await POST(post(pereira));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.currentSeason).toBeUndefined();
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).toContain("No se pudo consultar el clima de los últimos días");
  });

  it("devuelve 400 si el cuerpo no es JSON", async () => {
    const response = await POST(post("{no es json"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("JSON");
  });

  it("devuelve 400 si faltan prioridades o el rango de años es inválido", async () => {
    const withoutPriorities = await POST(post({ lat: 4.8, lon: -75.7, startYear: 2020, endYear: 2022 }));
    const reversedYears = await POST(post({ ...pereira, startYear: 2022, endYear: 2020 }));
    expect(withoutPriorities.status).toBe(400);
    expect(reversedYears.status).toBe(400);
    expect(await withoutPriorities.json()).toEqual({ error: "Parámetros inválidos" });
  });

  it("devuelve 400 con el motivo si el rango supera los 15 años o incluye el año en curso", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const tooLong = await POST(post({ ...pereira, startYear: 1981, endYear: 1996 }));
    const currentYear = await POST(post({ ...pereira, startYear: 2020, endYear: new Date().getFullYear() }));
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error).toContain("15 años");
    expect(currentYear.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el cultivo actual no está en el catálogo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })));
    const response = await POST(post({ ...pereira, priorities: { ...priorities, currentCropId: "quinua" } }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("quinua");
  });

  it("con Farm consulta NASA POWER en farm.centroid y declara los vacíos del lote en cada rotación", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(fixture, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const farm = { centroid: { lat: 4.5339, lon: -75.6811 }, locationSource: "search", terrain: { kind: "point" } };
    const response = await POST(post({ ...pereira, farm }));
    const body = await response.json();
    expect(response.status).toBe(200);
    // NASA POWER se consulta al centro de la celda del centroide (Armenia: 4.5, -75.625), no al de lat/lon de Pereira (5, -75.625).
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("latitude")).toBe("4.5");
    expect(url.searchParams.get("longitude")).toBe("-75.625");
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).toContain("límites");
  });

  it("devuelve 400 con el motivo si el Farm no pasa la validación geográfica, sin llamar a NASA POWER", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const ring = [[-75.6965507452, 4.8128508444], [-75.6956492548, 4.8128508444], [-75.6956492548, 4.8137491556], [-75.6965507452, 4.8137491556], [-75.6965507452, 4.8128508444]];
    const farm = { centroid: { lat: 4.8133, lon: -75.6961 }, locationSource: "map", terrain: { kind: "polygon", areaHa: 9, ring } };
    const response = await POST(post({ ...pereira, farm }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("1 %");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el Farm no cumple el esquema", async () => {
    const response = await POST(post({ ...pereira, farm: { centroid: { lat: 4.8, lon: -75.7 }, locationSource: "gps", terrain: { kind: "circle" } } }));
    expect(response.status).toBe(400);
  });

  it("usa la muestra precargada cuando NASA POWER no responde para Pereira", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await POST(post(pereira));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.climate.source).toBe("sample");
  });

  it("devuelve 502 sin stack trace cuando NASA POWER falla y no hay muestra", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await POST(post({ ...pereira, lat: 0, lon: 0 }));
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(Object.keys(body)).toEqual(["error"]);
  });
});
