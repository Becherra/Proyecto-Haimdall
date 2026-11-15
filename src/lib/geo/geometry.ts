import type { FarmTerrain } from "../../types";
import {
  APPROXIMATE_AREA_RANGES_HA,
  LARGE_TERRAIN_WARNING_HA,
  MAX_TERRAIN_ABS_LATITUDE,
  MAX_TERRAIN_AREA_HA,
  MIN_TERRAIN_AREA_HA,
  representativeAreaHa,
} from "./limits";

export type GeoJsonPosition = readonly [longitude: number, latitude: number];
export type GeoJsonRing = readonly GeoJsonPosition[];
export type GeographicBounds = readonly [south: number, north: number, west: number, east: number];
export type TerrainValidation = { valid: boolean; errors: string[]; warnings: string[]; calculatedAreaHa?: number };

const METERS_PER_DEGREE = 111_320;
const HECTARES_PER_SQUARE_METER = 10_000;
const INTERSECTION_EPSILON = 1e-12;

function assertClosedRing(ring: GeoJsonRing): void {
  if (ring.length < 4) throw new RangeError("El polígono requiere al menos tres vértices y el punto de cierre");
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) throw new RangeError("El anillo debe estar cerrado");
  for (const [longitude, latitude] of ring) {
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new RangeError("El anillo contiene coordenadas fuera de rango");
    }
  }
}

function projectRing(ring: GeoJsonRing): { points: Array<readonly [number, number]>; meanLatitude: number } {
  assertClosedRing(ring);
  const vertices = ring.slice(0, -1);
  const meanLatitude = vertices.reduce((sum, [, latitude]) => sum + latitude, 0) / vertices.length;
  const longitudeScale = METERS_PER_DEGREE * Math.cos(meanLatitude * Math.PI / 180);
  const points = vertices.map(([longitude, latitude]) => [longitude * longitudeScale, latitude * METERS_PER_DEGREE] as const);
  return { points, meanLatitude };
}

/** Calculates polygon area with a local equirectangular projection, suitable for farm-sized rings. */
export function polygonAreaHa(ring: GeoJsonRing): number {
  const { points } = projectRing(ring);
  let doubleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current && next) doubleArea += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(doubleArea) / 2 / HECTARES_PER_SQUARE_METER;
}

/** Calculates the area-weighted centroid of a closed GeoJSON polygon ring. */
export function polygonCentroid(ring: GeoJsonRing): { lat: number; lon: number } {
  const { points, meanLatitude } = projectRing(ring);
  let crossSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    const cross = current[0] * next[1] - next[0] * current[1];
    crossSum += cross;
    xSum += (current[0] + next[0]) * cross;
    ySum += (current[1] + next[1]) * cross;
  }
  if (Math.abs(crossSum) < Number.EPSILON) throw new RangeError("El polígono no tiene un área calculable");
  const centroidX = xSum / (3 * crossSum);
  const centroidY = ySum / (3 * crossSum);
  const longitudeScale = METERS_PER_DEGREE * Math.cos(meanLatitude * Math.PI / 180);
  return { lat: centroidY / METERS_PER_DEGREE, lon: centroidX / longitudeScale };
}

/** Returns [south, north, west, east] from a closed ring using GeoJSON [lon, lat] positions. */
export function bboxOfRing(ring: GeoJsonRing): GeographicBounds {
  assertClosedRing(ring);
  const vertices = ring.slice(0, -1);
  const latitudes = vertices.map(([, latitude]) => latitude);
  const longitudes = vertices.map(([longitude]) => longitude);
  return [Math.min(...latitudes), Math.max(...latitudes), Math.min(...longitudes), Math.max(...longitudes)];
}

function orientation(a: GeoJsonPosition, b: GeoJsonPosition, c: GeoJsonPosition): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: GeoJsonPosition, b: GeoJsonPosition, point: GeoJsonPosition): boolean {
  return point[0] >= Math.min(a[0], b[0]) - INTERSECTION_EPSILON
    && point[0] <= Math.max(a[0], b[0]) + INTERSECTION_EPSILON
    && point[1] >= Math.min(a[1], b[1]) - INTERSECTION_EPSILON
    && point[1] <= Math.max(a[1], b[1]) + INTERSECTION_EPSILON;
}

function segmentsIntersect(a: GeoJsonPosition, b: GeoJsonPosition, c: GeoJsonPosition, d: GeoJsonPosition): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return (Math.abs(abC) <= INTERSECTION_EPSILON && onSegment(a, b, c))
    || (Math.abs(abD) <= INTERSECTION_EPSILON && onSegment(a, b, d))
    || (Math.abs(cdA) <= INTERSECTION_EPSILON && onSegment(c, d, a))
    || (Math.abs(cdB) <= INTERSECTION_EPSILON && onSegment(c, d, b));
}

/** Detects non-adjacent edge crossings and self-touching loops in a GeoJSON ring. */
export function isSelfIntersecting(ring: GeoJsonRing): boolean {
  if (ring.length < 4) return false;
  const segmentCount = ring.length - 1;
  for (let first = 0; first < segmentCount; first += 1) {
    const a = ring[first];
    const b = ring[first + 1];
    if (!a || !b) continue;
    for (let second = first + 1; second < segmentCount; second += 1) {
      if (second === first + 1 || (first === 0 && second === segmentCount - 1)) continue;
      const c = ring[second];
      const d = ring[second + 1];
      if (c && d && segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/** Builds a closed GeoJSON square centered on a coordinate with the requested area. */
export function squareFromArea(centroid: { lat: number; lon: number }, areaHa: number): GeoJsonRing {
  if (!Number.isFinite(centroid.lat) || centroid.lat < -90 || centroid.lat > 90 || !Number.isFinite(centroid.lon) || centroid.lon < -180 || centroid.lon > 180) {
    throw new RangeError("El centroide está fuera de rango");
  }
  if (!Number.isFinite(areaHa) || areaHa <= 0) throw new RangeError("El área debe ser positiva");
  const halfSideMeters = Math.sqrt(areaHa * HECTARES_PER_SQUARE_METER) / 2;
  const latitudeDelta = halfSideMeters / METERS_PER_DEGREE;
  const longitudeScale = METERS_PER_DEGREE * Math.cos(centroid.lat * Math.PI / 180);
  if (Math.abs(longitudeScale) < 1) throw new RangeError("No se puede calcular un cuadrado cerca de los polos");
  const longitudeDelta = halfSideMeters / longitudeScale;
  const south = centroid.lat - latitudeDelta;
  const north = centroid.lat + latitudeDelta;
  const west = centroid.lon - longitudeDelta;
  const east = centroid.lon + longitudeDelta;
  if (south < -90 || north > 90 || west < -180 || east > 180) throw new RangeError("El cuadrado sale de los límites geográficos");
  return [[west, south], [east, south], [east, north], [west, north], [west, south]];
}

function areaErrors(areaHa: number): string[] {
  if (!Number.isFinite(areaHa) || areaHa <= 0) return ["El área debe ser un número positivo y finito."];
  if (areaHa < MIN_TERRAIN_AREA_HA) return [`El área mínima es ${MIN_TERRAIN_AREA_HA} ha.`];
  if (areaHa > MAX_TERRAIN_AREA_HA) return [`El área máxima permitida es ${MAX_TERRAIN_AREA_HA} ha.`];
  return [];
}

function invalid(errors: string[], warnings: string[] = [], calculatedAreaHa?: number): TerrainValidation {
  return { valid: false, errors, warnings, ...(calculatedAreaHa === undefined ? {} : { calculatedAreaHa }) };
}

/** Applies structural and geographic rules; polygon area is recalculated instead of trusted. */
export function validateTerrain(terrain: FarmTerrain): TerrainValidation {
  if (terrain.kind === "point") return { valid: true, errors: [], warnings: [] };
  if (terrain.kind === "approx_size") {
    const errors = areaErrors(terrain.areaHa);
    if (terrain.areaRangeHa) {
      const knownRange = APPROXIMATE_AREA_RANGES_HA.some(([minimum, maximum]) => minimum === terrain.areaRangeHa?.[0] && maximum === terrain.areaRangeHa?.[1]);
      if (!knownRange) errors.push("El rango de área aproximada no está permitido.");
      else if (Math.abs(terrain.areaHa - representativeAreaHa(terrain.areaRangeHa)) > 1e-9) errors.push("El área representativa debe ser el punto medio del rango.");
    }
    const warnings = terrain.areaHa > LARGE_TERRAIN_WARNING_HA ? ["El área supera 1.000 ha; confirma que el tamaño sea correcto."] : [];
    return { valid: errors.length === 0, errors, warnings };
  }

  const ring = terrain.ring;
  if (ring.length < 4) return invalid(["El polígono requiere al menos tres vértices y el punto de cierre."]);
  if (ring.some(([longitude, latitude]) => !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    return invalid(["El anillo contiene coordenadas fuera de rango."]);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) return invalid(["El anillo debe estar cerrado."]);
  if (ring.some(([, latitude]) => Math.abs(latitude) > MAX_TERRAIN_ABS_LATITUDE)) {
    return invalid([`No se admiten polígonos más allá de ${MAX_TERRAIN_ABS_LATITUDE}° de latitud: la proyección local pierde precisión cerca de los polos.`]);
  }
  if (ring.some(([longitude], index) => index > 0 && Math.abs(longitude - (ring[index - 1]?.[0] ?? longitude)) > 180)) {
    return invalid(["No se admiten polígonos que crucen el antimeridiano."]);
  }
  if (isSelfIntersecting(ring)) return invalid(["El polígono se cruza consigo mismo."]);
  let calculatedAreaHa: number;
  try { calculatedAreaHa = polygonAreaHa(ring); }
  catch (error) { return invalid([error instanceof Error ? error.message : "No se pudo calcular el área del polígono."]); }
  const errors = areaErrors(calculatedAreaHa);
  if (calculatedAreaHa > 0 && Math.abs(calculatedAreaHa - terrain.areaHa) / calculatedAreaHa > 0.01) {
    errors.push("El área declarada difiere más de 1 % del área calculada.");
  }
  const warnings = calculatedAreaHa > LARGE_TERRAIN_WARNING_HA ? ["El área supera 1.000 ha; confirma que el tamaño sea correcto."] : [];
  return { valid: errors.length === 0, errors, warnings, calculatedAreaHa };
}
