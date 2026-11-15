import { EARTH_METERS_PER_DEGREE } from "../../src/lib/srtm";
import type { GridPlan } from "../../src/lib/terrainGrid";

/** Altitud de un plano inclinado sobre la malla del plan: `eastSlope` y `northSlope` son metros de subida por metro (0.1 = 10 %). */
export function planeElevations(plan: GridPlan, { eastSlope = 0, northSlope = 0, base = 1500 }: { eastSlope?: number; northSlope?: number; base?: number } = {}): number[] {
  const center = plan.locations[Math.floor(plan.locations.length / 2)]!;
  const eastMetersPerDegree = EARTH_METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180);
  return plan.locations.map(({ lat, lon }) => base + eastSlope * (lon - center.lon) * eastMetersPerDegree + northSlope * (lat - center.lat) * EARTH_METERS_PER_DEGREE);
}

/** Cuerpo de respuesta de OpenTopoData con esas altitudes (null = sin dato). */
export function openTopoBody(elevations: ReadonlyArray<number | null>, status = "OK"): string {
  return JSON.stringify({ status, results: elevations.map((elevation) => ({ elevation, location: { lat: 0, lng: 0 }, dataset: "srtm30m" })) });
}
