import { z } from "zod";

const BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const PARAMETERS = ["T2M", "T2M_MIN", "T2M_MAX", "PRECTOTCORR", "EVLAND", "GWETROOT", "ALLSKY_SFC_SW_DWN"] as const;
const responseSchema = z.object({ properties: z.object({ parameter: z.record(z.string(), z.record(z.string(), z.number())) }) });
const requestSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90), lon: z.number().finite().gte(-180).lte(180),
  startYear: z.number().int().gte(1900).lte(2100), endYear: z.number().int().gte(1900).lte(2100),
}).refine((value) => value.startYear <= value.endYear, "startYear debe ser menor o igual que endYear");

export type ClimateParameter = (typeof PARAMETERS)[number];
export type DailyClimateRecord = { date: string } & Record<ClimateParameter, number | null>;
export type ClimateResult = { records: DailyClimateRecord[]; missingByParameter: Record<ClimateParameter, number> };
export type ClimateRequest = { lat: number; lon: number; startYear: number; endYear: number };
const cache = new Map<string, Promise<ClimateResult>>();

function buildUrl(input: ClimateRequest): string {
  const params = new URLSearchParams({ parameters: PARAMETERS.join(","), community: "AG", latitude: String(input.lat), longitude: String(input.lon), start: `${input.startYear}0101`, end: `${input.endYear}1231`, format: "JSON" });
  return `${BASE_URL}?${params.toString()}`;
}

function parseResponse(payload: unknown): ClimateResult {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("NASA POWER devolvió una respuesta malformada");
  const parameterData = parsed.data.properties.parameter;
  const dates = new Set(Object.values(parameterData).flatMap((values) => Object.keys(values)));
  const missingByParameter = Object.fromEntries(PARAMETERS.map((name) => [name, 0])) as Record<ClimateParameter, number>;
  const records = [...dates].sort().map((date) => {
    const record = { date } as DailyClimateRecord;
    for (const name of PARAMETERS) {
      const value = parameterData[name]?.[date];
      record[name] = value === -999 ? null : (value ?? null);
      if (value === -999) missingByParameter[name] += 1;
    }
    return record;
  });
  return { records, missingByParameter };
}

async function requestClimate(url: string): Promise<ClimateResult> {
  let response: Response;
  try { response = await fetch(url); } catch { throw new Error("No se pudo conectar con NASA POWER"); }
  if (!response.ok) throw new Error(`NASA POWER respondió con HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("NASA POWER devolvió JSON inválido"); }
  return parseResponse(payload);
}

/** Obtiene y normaliza datos climáticos diarios de NASA POWER para un punto y rango de años. */
export function fetchDailyClimate(input: ClimateRequest): Promise<ClimateResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Solicitud climática inválida: ${parsed.error.issues[0]?.message ?? "revisa los parámetros"}`);
  const url = buildUrl(parsed.data);
  const cached = cache.get(url);
  if (cached) return cached;
  const request = requestClimate(url).catch((error: unknown) => { cache.delete(url); throw error; });
  cache.set(url, request);
  return request;
}

export function clearClimateCache(): void { cache.clear(); }
