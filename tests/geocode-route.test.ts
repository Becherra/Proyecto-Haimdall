import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/geocode/route";
import { clearGeocodeCache } from "../src/lib/geocode";

const validPayload = [{ lat: "4.8133", lon: "-75.6961", display_name: "Pereira, Risaralda, Colombia" }];

describe("GET /api/geocode", () => {
  beforeEach(() => { clearGeocodeCache(); vi.restoreAllMocks(); });

  it("devuelve 200 con la ubicación normalizada", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPayload), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new Request("http://localhost/api/geocode?q=Pereira%2C%20Colombia"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lat: 4.8133, lon: -75.6961, label: "Pereira, Risaralda, Colombia" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("limit=1");
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": expect.any(String) }) }));
  });

  it("devuelve 400 para una consulta inválida", async () => {
    const response = await GET(new Request("http://localhost/api/geocode?q=x"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "La búsqueda debe tener entre 2 y 100 caracteres" });
  });

  it("devuelve 404 si Nominatim no encuentra resultados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
    const response = await GET(new Request("http://localhost/api/geocode?q=Atlantis"));
    expect(response.status).toBe(404);
  });

  it("devuelve 502 si falla el servicio externo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(new Request("http://localhost/api/geocode?q=Pereira"));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("conectar");
  });
});
