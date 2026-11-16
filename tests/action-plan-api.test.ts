import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analysis/route";
import { clearClimateCache } from "../src/lib/nasaPower";
import fixture from "./fixtures/power-pereira.json";
import { analysisResponseSchema } from "../src/types";
vi.mock("../src/lib/terrainLive", () => ({ fetchLiveTerrain: vi.fn().mockResolvedValue(null) }));
const body = { lat: 4.8133, lon: -75.6961, startYear: 2020, endYear: 2022, priorities: { currentCropId: "cafe", waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 } };
const request = (value: unknown) => new Request("http://localhost/api/analysis", { method: "POST", body: JSON.stringify(value) });
describe("contrato del plan en API", () => {
  beforeEach(() => { clearClimateCache(); vi.restoreAllMocks(); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json(fixture)))); });
  it("agrega plan por alternativa y conserva los puntajes", async () => {
    const previous = await (await POST(request(body))).json();
    const response = await POST(request({ ...body, cropProfile: { cropId: "cafe", cultivarId: "unknown", stageId: "produccion" } }));
    expect(response.status).toBe(200);
    const result = analysisResponseSchema.parse(await response.json());
    expect(result.rotations.map((r) => r.score)).toEqual(previous.rotations.map((r: { score: number }) => r.score));
    expect(result.rotations.every((r) => r.actionPlan !== undefined)).toBe(true);
    expect(analysisResponseSchema.safeParse({ ...result, rotations: result.rotations.map(({ actionPlan: _plan, ...r }) => r) }).success).toBe(true);
  });
  it("rechaza perfil incoherente antes de consultar fuentes", async () => {
    const response = await POST(request({ ...body, cropProfile: { cropId: "platano", cultivarId: "unknown", stageId: "vegetativo" } }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
