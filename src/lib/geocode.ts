import { z } from "zod";
import { locationBoundingBoxSchema, locationResultSchema, type LocationResult } from "../types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 8_000;
const RATE_LIMIT_MS = 1_000;
const DEFAULT_USER_AGENT = "Heimdall/1.0 (NASA Space Apps 2026)";
const querySchema = z.string().trim().min(2).max(100);
const nominatimItemSchema = z.object({ lat: z.string(), lon: z.string(), display_name: z.string().min(1), boundingbox: z.array(z.string()).length(4).optional() });

export class GeocodeValidationError extends Error {}
export class GeocodeParseError extends Error {}
export class GeocodeServiceError extends Error {}

export type GeocodeDependencies = {
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  userAgent?: string;
};

const cache = new Map<string, Promise<LocationResult | null>>();
let rateQueue = Promise.resolve();
let lastRequestAt: number | null = null;

/** Normaliza consultas para compartir caché entre diferencias de mayúsculas y espacios. */
export function normalizeGeocodeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

/** Convierte la respuesta externa de Nominatim al contrato estable de la aplicación. */
export function parseGeocodeResponse(payload: unknown): LocationResult | null {
  const parsed = z.array(nominatimItemSchema).safeParse(payload);
  if (!parsed.success) throw new GeocodeParseError("Nominatim devolvió una respuesta malformada");
  const first = parsed.data[0];
  if (!first) return null;
  const boundingBox = first.boundingbox?.map(Number);
  const parsedBoundingBox = boundingBox === undefined ? undefined : locationBoundingBoxSchema.safeParse(boundingBox);
  if (parsedBoundingBox && !parsedBoundingBox.success) throw new GeocodeParseError("Nominatim devolvió un bounding box inválido");
  const location = locationResultSchema.safeParse({ lat: Number(first.lat), lon: Number(first.lon), label: first.display_name, boundingBox: parsedBoundingBox?.success ? parsedBoundingBox.data : undefined });
  if (!location.success) throw new GeocodeParseError("Nominatim devolvió coordenadas inválidas");
  return location.data;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForRateLimit(now: () => number, sleep: (milliseconds: number) => Promise<void>): Promise<void> {
  const slot = rateQueue.then(async () => {
    const elapsed = lastRequestAt === null ? RATE_LIMIT_MS : now() - lastRequestAt;
    const remaining = Math.max(0, RATE_LIMIT_MS - elapsed);
    if (remaining > 0 && lastRequestAt !== null) await sleep(remaining);
    lastRequestAt = now();
  });
  rateQueue = slot.catch(() => undefined);
  return slot;
}

async function requestLocation(query: string, dependencies: Required<GeocodeDependencies>): Promise<LocationResult | null> {
  await waitForRateLimit(dependencies.now, dependencies.sleep);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  let response: Response;
  try {
    response = await dependencies.fetcher(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": dependencies.userAgent } });
  } catch (error) {
    throw new GeocodeServiceError(error instanceof Error && error.name === "AbortError" ? "El servicio de geocodificación agotó el tiempo de espera" : "No se pudo conectar con el servicio de geocodificación");
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new GeocodeServiceError(`El servicio de geocodificación respondió con HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new GeocodeServiceError("El servicio de geocodificación devolvió JSON inválido"); }
  return parseGeocodeResponse(payload);
}

/** Busca una ubicación en Nominatim respetando su límite de uso y la caché del servidor. */
export function geocodeLocation(query: string, dependencies: GeocodeDependencies = {}): Promise<LocationResult | null> {
  const parsedQuery = querySchema.safeParse(query);
  if (!parsedQuery.success) throw new GeocodeValidationError("La búsqueda debe tener entre 2 y 100 caracteres");
  const normalizedQuery = normalizeGeocodeQuery(parsedQuery.data);
  const cached = cache.get(normalizedQuery);
  if (cached) return cached;
  const resolved: Required<GeocodeDependencies> = {
    fetcher: dependencies.fetcher ?? fetch,
    now: dependencies.now ?? Date.now,
    sleep: dependencies.sleep ?? delay,
    userAgent: dependencies.userAgent ?? process.env.GEOCODER_USER_AGENT?.trim() ?? DEFAULT_USER_AGENT,
  };
  const request = requestLocation(normalizedQuery, resolved).catch((error: unknown) => { cache.delete(normalizedQuery); throw error; });
  cache.set(normalizedQuery, request);
  return request;
}

export function clearGeocodeCache(): void {
  cache.clear();
  rateQueue = Promise.resolve();
  lastRequestAt = null;
}
