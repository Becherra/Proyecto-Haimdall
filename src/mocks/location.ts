import { locationResultSchema, type LocationResult } from "../types";

export const mockLocation: LocationResult = locationResultSchema.parse({
  lat: 4.8133,
  lon: -75.6961,
  label: "Finca de muestra, Pereira, Colombia",
  boundingBox: [4.6646, 4.9062, -75.9359, -75.3754],
});
