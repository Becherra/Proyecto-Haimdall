import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAnalysisResponse } from "../src/mocks";
import { analysisPeriod, buildAnalysisRequest, isAnalysisMockMode, runAnalysis } from "../src/services/analysis";
import type { Farm, UserPriorities } from "../src/types";

const farm: Farm = {
  centroid: { lat: 4.8133, lon: -75.6961 }, locationSource: "search", placeLabel: "Pereira",
  terrain: { kind: "point" },
};
const priorities: UserPriorities = {
  waterSaving: 5, extraIncome: 2, soilImprovement: 4, erosionReduction: 3, lowRisk: 4,
  currentCropId: "maiz", waterAvailability: "medium",
};

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("analysis service", () => {
  it("builds a request with the farm centroid, goals and lean-response defaults", () => {
    expect(buildAnalysisRequest(farm, priorities)).toEqual({
      lat: 4.8133, lon: -75.6961, ...analysisPeriod(), farm, priorities,
    });
  });

  it("analyzes the last 15 complete years, so the baseline includes El Niño and La Niña years", () => {
    expect(analysisPeriod(new Date("2026-11-15T12:00:00Z"))).toEqual({ startYear: 2011, endYear: 2025 });
    expect(analysisPeriod(new Date("2027-01-02T12:00:00Z"))).toEqual({ startYear: 2012, endYear: 2026 });
  });

  it("adds an optional climate scenario without changing farm or priorities", () => {
    expect(buildAnalysisRequest(farm, priorities, { tempDeltaC: 2, rainFactor: 0.8 })).toMatchObject({
      farm, priorities, scenario: { tempDeltaC: 2, rainFactor: 0.8 },
    });
  });

  it("validates the server response and posts the request body", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "false");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, json: async () => mockAnalysisResponse } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const request = buildAnalysisRequest(farm, priorities);

    await expect(runAnalysis(request)).resolves.toEqual(mockAnalysisResponse);
    expect(fetchMock).toHaveBeenCalledWith("/api/analysis", expect.objectContaining({
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
    }));
  });

  it("returns a clear API error and rejects malformed success responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "false");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "No hay muestra para ese sitio" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rotations: [] }) } as Response));

    await expect(runAnalysis(buildAnalysisRequest(farm, priorities))).rejects.toThrow("No hay muestra para ese sitio");
    await expect(runAnalysis(buildAnalysisRequest(farm, priorities))).rejects.toThrow("respuesta del análisis no coincide");
  });

  it("uses the complete mock only when requested and does not fake scenarios", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
    expect(isAnalysisMockMode()).toBe(true);
    await expect(runAnalysis(buildAnalysisRequest(farm, priorities))).resolves.toEqual(mockAnalysisResponse);
    await expect(runAnalysis(buildAnalysisRequest(farm, priorities, { tempDeltaC: 2 }))).rejects.toThrow("requieren el backend real");
  });
});
