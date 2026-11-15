import { z } from "zod";
import armeniaSample from "../../data/samples/power-armenia.json";
import manizalesSample from "../../data/samples/power-manizales.json";
import pereiraSample from "../../data/samples/power-pereira.json";
import { CLIMATE_PARAMETERS, climateResultSchema, type ClimateParameter, type ClimateRecord, type ClimateRequest, type ClimateResult } from "../types";

const BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const MIN_YEAR = 1981;
const MAX_RANGE_YEARS = 15;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [100, 250] as const;
/**
 * Respuestas reales de NASA POWER (2020–2022) guardadas para que la demo no dependa de la red.
 * Cada una cubre los sitios a menos de `tolerance` grados; Santa Rosa de Cabal cae dentro de la de Pereira (misma celda de NASA POWER).
 */
const SAMPLES: ReadonlyArray<{ lat: number; lon: number; tolerance: number; payload: unknown }> = [
  { lat: 4.8133, lon: -75.6961, tolerance: 0.1, payload: pereiraSample },
  { lat: 5.0689, lon: -75.5174, tolerance: 0.1, payload: manizalesSample },
  { lat: 4.5339, lon: -75.6811, tolerance: 0.1, payload: armeniaSample },
];
const responseSchema = z.object({
  geometry: z.object({ coordinates: z.array(z.number()) }).optional(),
  properties: z.object({ parameter: z.record(z.string(), z.record(z.string(), z.number())) }),
});
const requestSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90), lon: z.number().finite().gte(-180).lte(180),
  startYear: z.number().int().gte(MIN_YEAR).lte(new Date().getFullYear() - 1), endYear: z.number().int().gte(MIN_YEAR).lte(new Date().getFullYear() - 1),
}).refine((value) => value.startYear <= value.endYear, "startYear debe ser menor o igual que endYear")
  .refine((value) => value.endYear - value.startYear + 1 <= MAX_RANGE_YEARS, `El rango máximo es de ${MAX_RANGE_YEARS} años`);

/** La solicitud climática es inválida (años fuera de rango, etc.): lo corrige quien llama, no es una falla de NASA POWER. */
export class InvalidClimateRequestError extends Error {}
class RetryableClimateError extends Error {}
class ClimateServerError extends RetryableClimateError {}

function buildUrl(input: ClimateRequest): string {
  const params = new URLSearchParams({ parameters: CLIMATE_PARAMETERS.join(","), community: "AG", latitude: String(input.lat), longitude: String(input.lon), start: `${input.startYear}0101`, end: `${input.endYear}1231`, format: "JSON" });
  return `${BASE_URL}?${params.toString()}`;
}


function parseResponse(payload: unknown, source: ClimateResult["source"], input?: ClimateRequest): ClimateResult {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success || CLIMATE_PARAMETERS.some((name) => !parsed.data?.properties.parameter[name])) throw new Error("NASA POWER devolvió una respuesta malformada");
  const parameterData = parsed.data.properties.parameter;
  const dates = new Set(Object.values(parameterData).flatMap((values) => Object.keys(values)));
  const missingByParameter = Object.fromEntries(CLIMATE_PARAMETERS.map((name) => [name, 0])) as Record<ClimateParameter, number>;
  const start = input ? `${input.startYear}0101` : "00000000";
  const end = input ? `${input.endYear}1231` : "99999999";
  const records = [...dates].filter((date) => date >= start && date <= end).sort().map((date) => {
    const record = { date } as ClimateRecord;
    for (const name of CLIMATE_PARAMETERS) {
      const value = parameterData[name][date];
      record[name] = value === -999 ? null : (value ?? null);
      if (value === undefined || value === -999) missingByParameter[name] += 1;
    }
    return record;
  });
  const rawElevation = parsed.data.geometry?.coordinates[2];
  const cellElevationMeters = rawElevation !== undefined && Number.isFinite(rawElevation) && rawElevation !== -999 ? rawElevation : undefined;
  return climateResultSchema.parse({ records, missingByParameter, source, ...(cellElevationMeters === undefined ? {} : { cellElevationMeters }) });
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchAttempt(url: string): Promise<ClimateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    throw new RetryableClimateError(error instanceof Error && error.name === "AbortError" ? "NASA POWER agotó el tiempo de espera de 15 segundos" : "No se pudo conectar con NASA POWER");
  } finally { clearTimeout(timeout); }
  if (response.status >= 500) throw new ClimateServerError(`NASA POWER respondió con HTTP ${response.status}`);
  if (!response.ok) throw new Error(`NASA POWER respondió con HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("NASA POWER devolvió JSON inválido"); }
  return parseResponse(payload, "live");
}

async function requestLive(url: string): Promise<ClimateResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try { return await fetchAttempt(url); }
    catch (error) {
      if (!(error instanceof RetryableClimateError) || attempt === MAX_RETRIES) throw error;
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw new Error("NASA POWER no respondió");
}

function sampleFor(input: ClimateRequest): ClimateResult | null {
  const sample = SAMPLES.find(({ lat, lon, tolerance }) => Math.abs(input.lat - lat) <= tolerance && Math.abs(input.lon - lon) <= tolerance);
  return sample ? parseResponse(sample.payload, "sample", input) : null;
}

/** Obtiene clima diario con timeout, reintentos y respaldo precargado por zona. */
export function fetchDailyClimate(input: ClimateRequest): Promise<ClimateResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new InvalidClimateRequestError(`Solicitud climática inválida: ${parsed.error.issues[0]?.message ?? "revisa los parámetros"}`);
  const normalizedInput = parsed.data;
  const url = buildUrl(normalizedInput);
  const cached = cache.get(url);
  if (cached) return cached.then((result) => ({ ...result, source: "cache" }));
  const request = requestLive(url).catch((error: unknown) => {
    if (error instanceof RetryableClimateError || error instanceof ClimateServerError) {
      const sample = sampleFor(normalizedInput);
      if (sample) return sample;
    }
    throw error;
  }).catch((error: unknown) => { cache.delete(url); throw error; });
  // Esta caché vive solo en el proceso; en serverless no persiste entre instancias.
  cache.set(url, request);
  return request;
}

const cache = new Map<string, Promise<ClimateResult>>();

export function clearClimateCache(): void { cache.clear(); }
