import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/drought/route";

const service = "Hosted/PRONÓSTICO_SEQUÍA_–_NOVIEMBRE_2026_Agre_3meses";
const attributes = {
  nomzh: "Cauca", agreg: 3,
  c_202611: "D0", c_202612: "D0", c_202701: "D1", c_202702: "D3", c_202703: "D3", c_202704: "D1",
  v_202611: -0.679, v_202612: -0.5878, v_202701: -1.082, v_202702: -1.891, v_202703: -1.672, v_202704: -1.215,
};

function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function mockIdeam() {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(jsonResponse({ services: [{ name: service, type: "FeatureServer" }] }))
    .mockResolvedValueOnce(jsonResponse({ layers: [{ id: 0, name: "ZH_MSDI03_multiescala_202609_202704" }] }))
    .mockResolvedValueOnce(jsonResponse({ editingInfo: { lastEditDate: 1794088063306 } }))
    .mockResolvedValueOnce(jsonResponse({ features: [{ attributes }] })));
}

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/drought", () => {
  it("returns a zone-level forecast for valid coordinates", async () => {
    mockIdeam();
    const response = await GET(new Request("http://localhost/api/drought?lat=4.8133&lon=-75.6961&aggregation=3"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.hydrographicZone).toBe("Cauca");
    expect(payload.geographyLevel).toBe("hydrographic-zone");
  });

  it("returns 400 for invalid query parameters without contacting IDEAM", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("http://localhost/api/drought?lat=95&lon=-75.6&aggregation=5"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a clear 404 when the point has no hydrographic-zone forecast", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ services: [{ name: service, type: "FeatureServer" }] }))
      .mockResolvedValueOnce(jsonResponse({ layers: [{ id: 0, name: "ZH_MSDI03_multiescala_202609_202704" }] }))
      .mockResolvedValueOnce(jsonResponse({ editingInfo: { lastEditDate: 1794088063306 } }))
      .mockResolvedValueOnce(jsonResponse({ features: [] })));
    const response = await GET(new Request("http://localhost/api/drought?lat=4.8133&lon=-75.6961"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "El IDEAM no tiene cobertura de pronóstico para esta ubicación." });
  });

  it("returns 502 when IDEAM is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const response = await GET(new Request("http://localhost/api/drought?lat=4.8133&lon=-75.6961"));
    expect(response.status).toBe(502);
  });
});
