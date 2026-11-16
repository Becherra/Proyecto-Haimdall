import { analysisRequestSchema, analysisResponseSchema } from "../types";
import type { AnalysisRequest, AnalysisResponse, ClimateScenario, CropProfileSelection, Farm, UserPriorities } from "../types";
import { mockAnalysisResponse } from "../mocks";

/** Años de clima que se analizan: los últimos 15 completos (el máximo que acepta el cliente de NASA POWER), para que la línea base incluya años de El Niño y de La Niña. */
const ANALYSIS_YEARS = 15;

/** Periodo de clima del análisis: termina en el último año completo. `now` se inyecta para poder probarlo. */
export function analysisPeriod(now: Date = new Date()): { startYear: number; endYear: number } {
  const endYear = now.getFullYear() - 1;
  return { startYear: endYear - ANALYSIS_YEARS + 1, endYear };
}

export type AnalysisRequestOptions = { scenario?: ClimateScenario; cropProfile?: CropProfileSelection };

/** Builds the shared API contract from the confirmed farm, the farmer's priorities and, if declared, the crop profile used by the action plan. */
export function buildAnalysisRequest(farm: Farm, priorities: UserPriorities, { scenario, cropProfile }: AnalysisRequestOptions = {}): AnalysisRequest {
  return analysisRequestSchema.parse({
    lat: farm.centroid.lat, lon: farm.centroid.lon, ...analysisPeriod(), priorities, farm,
    ...(scenario ? { scenario } : {}),
    ...(cropProfile ? { cropProfile } : {}),
  });
}

export function isAnalysisMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS === "true";
}

/** Calls the analysis API and validates its response before it reaches the UI. */
export async function runAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const parsedRequest = analysisRequestSchema.parse(request);
  if (isAnalysisMockMode()) {
    if (hasActiveScenario(parsedRequest.scenario)) throw new Error("Los escenarios requieren el backend real; desactiva NEXT_PUBLIC_USE_MOCKS.");
    return analysisResponseSchema.parse(mockAnalysisResponse);
  }

  let response: Response;
  try {
    response = await fetch("/api/analysis", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsedRequest),
    });
  } catch {
    throw new Error("No pudimos conectar con el análisis. Revisa tu conexión e inténtalo de nuevo.");
  }

  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error(getApiError(payload) ?? `El análisis respondió con HTTP ${response.status}.`);
  const parsedResponse = analysisResponseSchema.safeParse(payload);
  if (!parsedResponse.success) throw new Error("La respuesta del análisis no coincide con el contrato esperado.");
  return parsedResponse.data;
}

function hasActiveScenario(scenario: ClimateScenario | undefined): boolean {
  return scenario !== undefined && (scenario.tempDeltaC ?? 0) !== 0 || scenario !== undefined && (scenario.rainFactor ?? 1) !== 1;
}

function getApiError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
}
