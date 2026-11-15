import { z } from "zod";
import { locationBoundingBoxSchema, locationResultSchema, type LocationResult } from "../types";

// Nominatim prohíbe el autocompletado; Photon (también sobre OpenStreetMap) sí lo soporta y no pide clave.
const PHOTON_URL = "https://photon.komoot.io/api/";
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_SUGGESTIONS = 5;
const DEFAULT_USER_AGENT = "Heimdall/1.0 (NASA Space Apps 2026)";
// Centro de Colombia: los resultados cercanos pesan más, pero no se excluye el resto del mundo.
const COLOMBIA_BIAS = { lat: 4.57, lon: -74.3, scale: 0.3 };
const querySchema = z.string().trim().min(3).max(100);

const photonFeatureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    // Photon entrega [oeste, norte, este, sur]; nuestro contrato usa [sur, norte, oeste, este].
    extent: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  }),
});
const photonResponseSchema = z.object({ features: z.array(photonFeatureSchema) });

export class SuggestValidationError extends Error {}
export class SuggestParseError extends Error {}
export class SuggestServiceError extends Error {}

export type SuggestDependencies = { fetcher?: typeof fetch; userAgent?: string };

const cache = new Map<string, Promise<LocationResult[]>>();

/** Normaliza consultas para compartir caché entre diferencias de mayúsculas y espacios. */
export function normalizeSuggestQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function buildLabel(properties: z.infer<typeof photonFeatureSchema>["properties"]): string | null {
  const place = properties.name ?? properties.street;
  if (!place) return null;
  const parts = [place, properties.city ?? properties.county, properties.state, properties.country];
  // Evita "Pereira, Pereira, Risaralda" cuando el nombre coincide con el municipio.
  return parts.filter((part, index): part is string => Boolean(part) && parts.indexOf(part) === index).join(", ");
}

/** Convierte la respuesta externa de Photon en ubicaciones del contrato de la aplicación; ignora las que no se pueden usar. */
export function parseSuggestResponse(payload: unknown): LocationResult[] {
  const parsed = photonResponseSchema.safeParse(payload);
  if (!parsed.success) throw new SuggestParseError("Photon devolvió una respuesta malformada");
  const seen = new Set<string>();
  const results: LocationResult[] = [];
  for (const feature of parsed.data.features) {
    const label = buildLabel(feature.properties);
    if (!label || seen.has(label)) continue;
    const [lon, lat] = feature.geometry.coordinates;
    const extent = feature.properties.extent;
    const boundingBox = extent ? locationBoundingBoxSchema.safeParse([extent[3], extent[1], extent[0], extent[2]]) : null;
    const location = locationResultSchema.safeParse({ lat, lon, label, boundingBox: boundingBox?.success ? boundingBox.data : undefined });
    if (!location.success) continue;
    seen.add(label);
    results.push(location.data);
  }
  return results;
}

async function requestSuggestions(query: string, dependencies: Required<SuggestDependencies>): Promise<LocationResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(MAX_SUGGESTIONS));
  url.searchParams.set("lat", String(COLOMBIA_BIAS.lat));
  url.searchParams.set("lon", String(COLOMBIA_BIAS.lon));
  url.searchParams.set("location_bias_scale", String(COLOMBIA_BIAS.scale));
  let response: Response;
  try {
    response = await dependencies.fetcher(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": dependencies.userAgent } });
  } catch (error) {
    throw new SuggestServiceError(error instanceof Error && error.name === "AbortError" ? "El servicio de sugerencias agotó el tiempo de espera" : "No se pudo conectar con el servicio de sugerencias");
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new SuggestServiceError(`El servicio de sugerencias respondió con HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new SuggestServiceError("El servicio de sugerencias devolvió JSON inválido"); }
  return parseSuggestResponse(payload);
}

/** Devuelve hasta 5 lugares que coinciden con lo escrito (fincas, veredas, municipios) para que la persona elija. */
export function suggestLocations(query: string, dependencies: SuggestDependencies = {}): Promise<LocationResult[]> {
  const parsedQuery = querySchema.safeParse(query);
  if (!parsedQuery.success) throw new SuggestValidationError("Escribe al menos 3 caracteres");
  const normalized = normalizeSuggestQuery(parsedQuery.data);
  const cached = cache.get(normalized);
  if (cached) return cached;
  const resolved: Required<SuggestDependencies> = {
    fetcher: dependencies.fetcher ?? fetch,
    userAgent: dependencies.userAgent ?? process.env.GEOCODER_USER_AGENT?.trim() ?? DEFAULT_USER_AGENT,
  };
  const request = requestSuggestions(normalized, resolved).catch((error: unknown) => { cache.delete(normalized); throw error; });
  cache.set(normalized, request);
  return request;
}

export function clearSuggestCache(): void {
  cache.clear();
}
