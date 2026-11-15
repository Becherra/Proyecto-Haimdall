import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/climate/route";
import { clearClimateCache } from "../src/lib/nasaPower";

const fixture = readFileSync("tests/fixtures/power-pereira.json", "utf8");
const validUrl = "http://localhost/api/climate?lat=4.8133&lon=-75.6961&startYear=2020&endYear=2022";

describe("GET /api/climate", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); });

  it("devuelve 200 y la fixture normalizada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })));
    const response = await GET(new Request(validUrl));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source).toBe("live");
    expect(body.records[0].date).toBe("20200101");
  });

  it("devuelve 400 para parámetros inválidos", async () => {
    const response = await GET(new Request("http://localhost/api/climate?lat=999&lon=-75.6961&startYear=2020&endYear=2022"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Parámetros inválidos" });
  });

  it("devuelve 400 con el motivo cuando el rango supera los 15 años", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await GET(new Request("http://localhost/api/climate?lat=4.8133&lon=-75.6961&startYear=1981&endYear=1996"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("15 años");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("devuelve 502 cuando el servicio externo falla sin muestra disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(new Request("http://localhost/api/climate?lat=0&lon=0&startYear=2020&endYear=2022"));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("conectar");
  });

  it("devuelve la muestra cuando NASA POWER no está disponible para Pereira", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(new Request(validUrl));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source).toBe("sample");
    expect(body.records.length).toBeGreaterThan(1000);
  });
});
