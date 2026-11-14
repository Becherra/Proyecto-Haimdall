import { locationResultSchema, type LocationResult } from "../../types";

/** Valida las coordenadas de un pin usando el contrato compartido de ubicación. */
export function validateMapLocation(lat: number, lon: number, label = "Finca seleccionada"): LocationResult {
  return locationResultSchema.parse({ lat, lon, label });
}

/** Formatea coordenadas para el panel de confirmación sin ocultar su precisión. */
export function formatCoordinates(location: Pick<LocationResult, "lat" | "lon">): string {
  return `Lat ${location.lat.toFixed(4)} · Lon ${location.lon.toFixed(4)}`;
}
