import { droughtForecastSchema, type DroughtForecast } from "../lib/ui/droughtForecast";
import { mockDroughtForecast } from "../mocks/droughtForecast";

export type DroughtForecastResult = { forecast: DroughtForecast; isSample: boolean };
export type Coordinates = { lat: number; lon: number };

/** Gets the official drought outlook for the location's hydrographic zone through our backend. */
export async function getDroughtForecast(
  coordinates: Coordinates,
  aggregationMonths: 3 | 6 | 9 | 12 = 3,
  useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true",
): Promise<DroughtForecastResult> {
  if (useMocks) return { forecast: mockDroughtForecast, isSample: true };

  const query = new URLSearchParams({ lat: String(coordinates.lat), lon: String(coordinates.lon), aggregation: String(aggregationMonths) });
  let response: Response;
  try {
    response = await fetch(`/api/drought?${query.toString()}`);
  } catch {
    throw new Error("No pudimos consultar el pronóstico del IDEAM. Revisa tu conexión e inténtalo de nuevo.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 404) throw new Error("El pronóstico territorial del IDEAM aún no está conectado al servidor.");
  if (!response.ok) throw new Error("No pudimos consultar el pronóstico de sequía del IDEAM en este momento.");
  const parsed = droughtForecastSchema.safeParse(payload);
  if (!parsed.success) throw new Error("La respuesta del pronóstico del IDEAM no tiene el formato esperado.");
  return { forecast: parsed.data, isSample: false };
}
