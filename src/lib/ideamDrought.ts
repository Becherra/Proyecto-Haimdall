import { z } from "zod";
import { droughtCategorySchema, droughtForecastSchema, type DroughtCategory, type DroughtForecast } from "../types/drought";

const IDEAM_ROOT = "https://visualizador.ideam.gov.co/gisserver/rest/services";
const CATALOG_URL = `${IDEAM_ROOT}/Hosted?f=pjson`;
const FETCH_TIMEOUT_MS = 8_000;
const aggregationSchema = z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]);
const catalogSchema = z.object({ services: z.array(z.object({ name: z.string(), type: z.string() })) });
const serviceSchema = z.object({ layers: z.array(z.object({ id: z.number().int(), name: z.string() })).min(1) });
const layerSchema = z.object({ editingInfo: z.object({ lastEditDate: z.number().finite() }) });
const featuresSchema = z.object({ features: z.array(z.object({ attributes: z.record(z.string(), z.unknown()) })) });
const MONTH_NUMBERS: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

export type DroughtRequest = {
  lat: number;
  lon: number;
  aggregationMonths: z.infer<typeof aggregationSchema>;
};

export class IdeamDroughtError extends Error {
  constructor(message: string, readonly status: 404 | 422 | 502 | 503) {
    super(message);
    this.name = "IdeamDroughtError";
  }
}

/** Gets the official IDEAM drought category for the hydrographic zone containing a point. */
export async function fetchDroughtForecast(
  request: DroughtRequest,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<DroughtForecast> {
  const services = await fetchJson(CATALOG_URL, fetcher, catalogSchema);
  const selected = selectForecastService(services.services, request.aggregationMonths, monthKey(now));
  if (!selected) throw new IdeamDroughtError("El IDEAM aún no publicó un pronóstico vigente para este periodo.", 503);

  const serviceUrl = serviceUrlFor(selected.name);
  const service = await fetchJson(`${serviceUrl}?f=pjson`, fetcher, serviceSchema);
  const layerId = service.layers[0]?.id;
  if (layerId === undefined) throw new IdeamDroughtError("El servicio del IDEAM no contiene una capa de pronóstico.", 502);

  const layerUrl = `${serviceUrl}/${layerId}`;
  const metadata = await fetchJson(`${layerUrl}?f=pjson`, fetcher, layerSchema);
  const features = await fetchPointFeature(layerUrl, request, fetcher);
  if (features.features.length === 0) throw new IdeamDroughtError("El IDEAM no tiene cobertura de pronóstico para esta ubicación.", 404);
  if (features.features.length > 1) throw new IdeamDroughtError("La ubicación coincide con más de una zona hidrográfica; ajusta el punto de la finca.", 422);

  const attributes = features.features[0]?.attributes ?? {};
  const issuedAt = new Date(metadata.editingInfo.lastEditDate).toISOString().slice(0, 10);
  const forecast = toForecast(attributes, request.aggregationMonths, layerUrl, issuedAt, monthKey(now));
  const parsed = droughtForecastSchema.safeParse(forecast);
  if (!parsed.success) throw new IdeamDroughtError("La respuesta del IDEAM no coincide con el formato de pronóstico esperado.", 502);
  return parsed.data;
}

function selectForecastService(services: z.infer<typeof catalogSchema>["services"], aggregation: DroughtRequest["aggregationMonths"], currentMonth: string) {
  const candidates = services.flatMap((service) => {
    if (service.type !== "FeatureServer") return [];
    const normalizedName = removeAccents(service.name);
    const match = /PRONOSTICO_SEQUIA_.+?_([A-Z]+)_(\d{4})_Agre_(3|6|9|12)meses$/i.exec(normalizedName);
    if (!match || Number(match[3]) !== aggregation) return [];
    const issueMonth = MONTH_NUMBERS[match[1]?.toUpperCase() ?? ""];
    if (!issueMonth) return [];
    const issueKey = `${match[2]}-${String(issueMonth).padStart(2, "0")}`;
    return issueKey <= currentMonth ? [{ ...service, issueKey }] : [];
  });
  return candidates.sort((left, right) => right.issueKey.localeCompare(left.issueKey))[0] ?? null;
}

function toForecast(attributes: Record<string, unknown>, aggregationMonths: DroughtRequest["aggregationMonths"], layerUrl: string, issuedAt: string, currentMonth: string) {
  const months = Object.keys(attributes)
    .filter((key) => /^c_\d{6}$/.test(key))
    .map((key) => {
      const yyyymm = key.slice(2);
      const rawCategory = attributes[key];
      const category = categoryFromSource(rawCategory);
      if (!category) return null;
      const rawIndex = attributes[`v_${yyyymm}`];
      return { month: `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`, category, indexValue: typeof rawIndex === "number" && Number.isFinite(rawIndex) ? rawIndex : null };
    })
    .filter((month): month is NonNullable<typeof month> => month !== null)
    .sort((left, right) => left.month.localeCompare(right.month));
  const firstUpcomingMonth = months.find(({ month }) => month >= currentMonth)?.month;
  if (!firstUpcomingMonth) throw new IdeamDroughtError("El pronóstico publicado no incluye meses actuales o futuros.", 503);
  const hydrographicZone = attributes.nomzh;
  if (typeof hydrographicZone !== "string" || hydrographicZone.trim() === "") {
    throw new IdeamDroughtError("El IDEAM no informó la zona hidrográfica de esta ubicación.", 502);
  }
  return {
    source: "IDEAM" as const,
    sourceUrl: layerUrl,
    issuedAt,
    hydrographicZone,
    geographyLevel: "hydrographic-zone" as const,
    aggregationMonths,
    forecastStartMonth: firstUpcomingMonth,
    months,
  };
}

function categoryFromSource(value: unknown): DroughtCategory | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && ["SIN SEQUIA", "NO SEQUIA", "NORMAL", "NONE"].includes(removeAccents(value).trim())) return "none";
  const parsed = droughtCategorySchema.safeParse(value);
  if (!parsed.success) throw new IdeamDroughtError("El IDEAM devolvió una categoría de sequía desconocida.", 502);
  return parsed.data;
}

async function fetchPointFeature(layerUrl: string, request: DroughtRequest, fetcher: typeof fetch) {
  const query = new URLSearchParams({
    geometry: JSON.stringify({ x: request.lon, y: request.lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "*", returnGeometry: "false", resultRecordCount: "2", f: "pjson",
  });
  return fetchJson(`${layerUrl}/query?${query}`, fetcher, featuresSchema);
}

async function fetchJson<T>(url: string, fetcher: typeof fetch, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    throw new IdeamDroughtError("El servicio del IDEAM no respondió. Inténtalo de nuevo más tarde.", 502);
  }
  if (!response.ok) throw new IdeamDroughtError("El servicio del IDEAM respondió con un error.", 502);
  const payload: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new IdeamDroughtError("El servicio del IDEAM devolvió una respuesta incompleta o malformada.", 502);
  return parsed.data;
}

function serviceUrlFor(serviceName: string): string {
  const encodedPath = serviceName.split("/").map(encodeURIComponent).join("/");
  return `${IDEAM_ROOT}/${encodedPath}/FeatureServer`;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
}
