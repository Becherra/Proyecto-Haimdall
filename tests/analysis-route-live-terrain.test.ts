import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analysis/route";
import { squareFromArea } from "../src/lib/geo";
import { clearClimateCache } from "../src/lib/nasaPower";
import type { LiveTerrain } from "../src/lib/terrainGrid";
import { fetchLiveTerrain } from "../src/lib/terrainLive";
import { analysisResponseSchema } from "../src/types";

vi.mock("../src/lib/terrainLive", () => ({ fetchLiveTerrain: vi.fn(), clearLiveTerrainCache: vi.fn() }));

const fixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
const priorities = { waterSaving: 4, extraIncome: 2, soilImprovement: 3, erosionReduction: 3, lowRisk: 2 };
const bogota = { lat: 4.711, lon: -74.072, startYear: 2020, endYear: 2022, priorities };
const live: LiveTerrain = { elevationMeters: 2600, slopePercent: 22, slopeRangePercent: [5, 40], cellMeters: 30 };
const liveMock = vi.mocked(fetchLiveTerrain);

function post(body: unknown): Request {
  return new Request("http://localhost/api/analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/analysis con terreno en vivo", () => {
  beforeEach(() => {
    clearClimateCache();
    vi.restoreAllMocks();
    liveMock.mockReset();
    liveMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(fixture, { status: 200 })));
  });

  it("usa la altitud y la pendiente medidas y las declara como srtm-live", async () => {
    liveMock.mockResolvedValue(live);
    const response = await POST(post(bogota));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(analysisResponseSchema.safeParse(body).success).toBe(true);
    expect(body.indicators).toMatchObject({ terrainSource: "srtm-live", siteElevationMeters: 2600, slopePercent: 22, slopeRangePercent: [5, 40] });
    expect(body.dataSources.map((source: { id: string }) => source.id)).toContain("terrain-srtm-live");
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).not.toContain("No se pudo medir la altitud");
    expect(liveMock).toHaveBeenCalledWith({ lat: 4.711, lon: -74.072 });
  });

  it("si no se pudo medir lo dice en cada rotación y el análisis sigue", async () => {
    const response = await POST(post(bogota));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.indicators.terrainSource).toBeUndefined();
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).toContain("No se pudo medir la altitud y la pendiente del lote en vivo");
  });

  it("si falla la medición en un punto piloto, cae a la muestra precargada y lo dice", async () => {
    const body = await (await POST(post({ ...bogota, lat: 4.8133, lon: -75.6961 }))).json();
    expect(body.indicators).toMatchObject({ terrainSource: "srtm-sample", siteElevationMeters: 1413 });
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).toContain("No se pudo medir la altitud y la pendiente del lote en vivo");
  });

  it("no consulta nada si el agricultor ya declaró la altitud y la pendiente", async () => {
    const body = await (await POST(post({ ...bogota, priorities: { ...priorities, elevationMeters: 1500, slopePercent: 10 } }))).json();
    expect(liveMock).not.toHaveBeenCalled();
    expect(body.indicators).toMatchObject({ terrainSource: "user", siteElevationMeters: 1500, slopePercent: 10 });
    for (const rotation of body.rotations) expect(rotation.informationGaps.join(" ")).not.toContain("No se pudo medir la altitud");
  });

  it("si solo declaró una de las dos, mide la otra", async () => {
    liveMock.mockResolvedValue(live);
    const body = await (await POST(post({ ...bogota, priorities: { ...priorities, slopePercent: 8 } }))).json();
    expect(liveMock).toHaveBeenCalledTimes(1);
    expect(body.indicators).toMatchObject({ terrainSource: "user", slopePercent: 8, siteElevationMeters: 2600 });
  });

  it("con un lote dibujado mide el polígono y no solo el punto", async () => {
    liveMock.mockResolvedValue(live);
    const centroid = { lat: 4.711, lon: -74.072 };
    const ring = squareFromArea(centroid, 1);
    const farm = { centroid, locationSource: "map", terrain: { kind: "polygon", areaHa: 1, ring } };
    const response = await POST(post({ ...bogota, farm }));
    expect(response.status).toBe(200);
    expect(liveMock).toHaveBeenCalledWith(expect.objectContaining({ ring }));
  });
});
