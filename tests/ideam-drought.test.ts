import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDroughtForecast, type DroughtRequest } from "../src/lib/ideamDrought";

const request: DroughtRequest = { lat: 4.8133, lon: -75.6961, aggregationMonths: 3 };
const service = "Hosted/PRONÓSTICO_SEQUÍA_–_NOVIEMBRE_2026_Agre_3meses";
const catalog = { services: [
  { name: service, type: "FeatureServer" },
  { name: "Hosted/PRONÓSTICO_SEQUÍA_–_DICIEMBRE_2026_Agre_3meses", type: "FeatureServer" },
] };
const layerMetadata = { layers: [{ id: 0, name: "ZH_MSDI03_multiescala_202609_202704" }] };
const editingMetadata = { editingInfo: { lastEditDate: 1794088063306 } };
const attributes = {
  nomzh: "Cauca", agreg: 3,
  c_202610: "D1", c_202611: "D0", c_202612: "D0", c_202701: "D1", c_202702: "D3", c_202703: "D3", c_202704: "D1",
  v_202610: -1.2093, v_202611: -0.679, v_202612: -0.5878, v_202701: -1.082, v_202702: -1.891, v_202703: -1.672, v_202704: -1.215,
};

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function fetchSequence(...responses: Response[]) {
  const fetchMock = vi.fn().mockImplementation(async () => responses.shift());
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchDroughtForecast", () => {
  it("selects the latest published aggregation and formats the IDEAM zone data", async () => {
    const fetchMock = fetchSequence(jsonResponse(catalog), jsonResponse(layerMetadata), jsonResponse(editingMetadata), jsonResponse({ features: [{ attributes }] }));
    const result = await fetchDroughtForecast(request, fetchMock as typeof fetch, new Date("2026-11-15T12:00:00Z"));

    expect(result.hydrographicZone).toBe("Cauca");
    expect(result.forecastStartMonth).toBe("2026-11");
    expect(result.issuedAt).toBe("2026-11-07");
    expect(result.months.find(({ month }) => month === "2027-02")).toEqual({ month: "2027-02", category: "D3", indexValue: -1.891 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain("geometryType=esriGeometryPoint");
  });

  it("returns 404 when the point is outside the IDEAM forecast coverage", async () => {
    const fetchMock = fetchSequence(jsonResponse(catalog), jsonResponse(layerMetadata), jsonResponse(editingMetadata), jsonResponse({ features: [] }));
    await expect(fetchDroughtForecast(request, fetchMock as typeof fetch, new Date("2026-11-15T12:00:00Z")))
      .rejects.toMatchObject({ status: 404 });
  });

  it("returns 502 when the official service fails", async () => {
    const fetchMock = fetchSequence(new Response(null, { status: 503 }));
    await expect(fetchDroughtForecast(request, fetchMock as typeof fetch, new Date("2026-11-15T12:00:00Z")))
      .rejects.toMatchObject({ status: 502 });
  });

  it("rejects malformed upstream payloads with a clear upstream error", async () => {
    const fetchMock = fetchSequence(jsonResponse({ nope: [] }));
    await expect(fetchDroughtForecast(request, fetchMock as typeof fetch, new Date("2026-11-15T12:00:00Z")))
      .rejects.toMatchObject({ status: 502 });
  });
});
