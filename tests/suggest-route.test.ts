import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/geocode/suggest/route";
import { clearSuggestCache } from "../src/lib/suggest";

const payload = { features: [{ geometry: { coordinates: [-75.6792, 4.7172] }, properties: { name: "Finca La Esperanza", state: "Risaralda", country: "Colombia" } }] };

describe("GET /api/geocode/suggest", () => {
  beforeEach(() => { clearSuggestCache(); vi.restoreAllMocks(); });

  it("devuelve 200 con la lista de sugerencias", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    const response = await GET(new Request("http://localhost/api/geocode/suggest?q=finca%20la%20esperanza"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [{ lat: 4.7172, lon: -75.6792, label: "Finca La Esperanza, Risaralda, Colombia" }] });
  });

  it("devuelve 400 si la consulta es demasiado corta", async () => {
    const response = await GET(new Request("http://localhost/api/geocode/suggest?q=ab"));
    expect(response.status).toBe(400);
  });

  it("devuelve 502 si falla el servicio externo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(new Request("http://localhost/api/geocode/suggest?q=Pereira"));
    expect(response.status).toBe(502);
  });
});
