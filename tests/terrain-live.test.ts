import { beforeEach, describe, expect, it, vi } from "vitest";
import { squareFromArea } from "../src/lib/geo";
import { planTerrainGrid } from "../src/lib/terrainGrid";
import { clearLiveTerrainCache, fetchLiveTerrain } from "../src/lib/terrainLive";
import { openTopoBody, planeElevations } from "./helpers/terrainFields";

const PEREIRA = { lat: 4.8133, lon: -75.6961 };
const plan = planTerrainGrid(PEREIRA);
const slope10 = openTopoBody(planeElevations(plan, { eastSlope: 0.1 }));

function fetcherReturning(body: string, status = 200) {
  return vi.fn<typeof fetch>().mockImplementation(async () => new Response(body, { status }));
}

describe("fetchLiveTerrain", () => {
  beforeEach(() => { clearLiveTerrainCache(); });

  it("pide 81 puntos a OpenTopoData (SRTM 30 m) y devuelve la pendiente y la altitud del punto", async () => {
    const fetcher = fetcherReturning(slope10);
    const result = await fetchLiveTerrain(PEREIRA, { fetcher });
    expect(result?.slopePercent).toBeCloseTo(10, 1);
    expect(result?.elevationMeters).toBe(1500);
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe("https://api.opentopodata.org/v1/srtm30m");
    const locations = url.searchParams.get("locations")!.split("|");
    expect(locations).toHaveLength(81);
    expect(locations[40]).toBe(`${PEREIRA.lat.toFixed(6)},${PEREIRA.lon.toFixed(6)}`);
  });

  it("usa otra instancia de OpenTopoData si se configura", async () => {
    const fetcher = fetcherReturning(slope10);
    await fetchLiveTerrain(PEREIRA, { fetcher, baseUrl: "http://localhost:5000/" });
    expect(String(fetcher.mock.calls[0]![0]).startsWith("http://localhost:5000/v1/srtm30m?locations=")).toBe(true);
  });

  it("con un polígono pide 100 puntos y cuenta solo las celdas del lote", async () => {
    const ring = squareFromArea(PEREIRA, 1);
    const polygonPlan = planTerrainGrid({ ...PEREIRA, ring });
    const fetcher = fetcherReturning(openTopoBody(planeElevations(polygonPlan, { eastSlope: 0.05 })));
    const result = await fetchLiveTerrain({ ...PEREIRA, ring }, { fetcher });
    expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get("locations")!.split("|")).toHaveLength(100);
    expect(result?.slopePercent).toBeCloseTo(5, 1);
    expect(result?.cellMeters).toBe(30);
  });

  it("no repite la consulta para el mismo lugar, ni para uno a pocos metros", async () => {
    const fetcher = fetcherReturning(slope10);
    await fetchLiveTerrain(PEREIRA, { fetcher });
    await fetchLiveTerrain(PEREIRA, { fetcher });
    await fetchLiveTerrain({ lat: PEREIRA.lat + 0.00001, lon: PEREIRA.lon - 0.00001 }, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("un lugar a cientos de metros hace su propia consulta", async () => {
    const fetcher = fetcherReturning(slope10);
    await fetchLiveTerrain(PEREIRA, { fetcher });
    await fetchLiveTerrain({ lat: PEREIRA.lat + 0.01, lon: PEREIRA.lon }, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["HTTP 500", () => fetcherReturning("", 500)],
    ["HTTP 429 (límite de uso)", () => fetcherReturning("", 429)],
    ["sin conexión", () => vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))],
    ["JSON inválido", () => fetcherReturning("no es json")],
    ["estado distinto de OK", () => fetcherReturning(openTopoBody([], "INVALID_REQUEST"))],
    ["cantidad de resultados distinta", () => fetcherReturning(openTopoBody([1, 2, 3]))],
    ["todo sin dato (fuera de la cobertura de SRTM)", () => fetcherReturning(openTopoBody(plan.locations.map(() => null)))],
  ])("devuelve null y no lanza error ante %s", async (_label, makeFetcher) => {
    await expect(fetchLiveTerrain(PEREIRA, { fetcher: makeFetcher() })).resolves.toBeNull();
  });

  it("no guarda un fallo: la siguiente consulta vuelve a intentarlo", async () => {
    expect(await fetchLiveTerrain(PEREIRA, { fetcher: fetcherReturning("", 503) })).toBeNull();
    const fetcher = fetcherReturning(slope10);
    expect((await fetchLiveTerrain(PEREIRA, { fetcher }))?.slopePercent).toBeCloseTo(10, 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("devuelve null para coordenadas inválidas sin llamar a la red", async () => {
    const fetcher = fetcherReturning(slope10);
    expect(await fetchLiveTerrain({ lat: 95, lon: 0 }, { fetcher })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
