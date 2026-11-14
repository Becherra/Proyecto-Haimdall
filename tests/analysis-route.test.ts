import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analysis/route";
import { clearClimateCache } from "../src/lib/nasaPower";
import { analysisResponseSchema } from "../src/types";

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

  it("devuelve 400 si el cultivo actual no está en el catálogo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(fixture, { status: 200 })));
    const response = await POST(post({ ...pereira, priorities: { ...priorities, currentCropId: "cafe" } }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("cafe");
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
