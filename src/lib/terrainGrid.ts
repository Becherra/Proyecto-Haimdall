import { LIVE_TERRAIN } from "./config";
import { bboxOfRing, type GeoJsonRing } from "./geo";
import { EARTH_METERS_PER_DEGREE, hornSlopeFromWindow } from "./srtm";

/** Dónde medir: un punto o, si el agricultor dibujó su lote, el polígono (anillo GeoJSON [lon, lat]) centrado en ese punto. */
export type TerrainTarget = { lat: number; lon: number; ring?: GeoJsonRing };
export type GridLocation = { lat: number; lon: number };

/**
 * Malla de puntos donde consultar la altitud, en orden de filas (la fila 0 es el norte, la columna 0 el oeste).
 * `included[i]` dice si la celda `i` cuenta para el resultado: solo las interiores (con sus ocho vecinos) y, en un lote, las que caen dentro del polígono.
 */
export type GridPlan = { size: number; spacingMeters: number; locations: GridLocation[]; included: boolean[] };

/** Altitud y pendiente medidas sobre una malla de SRTM. `cellMeters` es la separación de esa malla. */
export type LiveTerrain = { elevationMeters: number; slopePercent: number; slopeRangePercent: [number, number]; cellMeters: number };

const MAX_SLOPE_PERCENT = 100;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** ¿Cae el punto dentro del anillo? Trazo de rayo en el plano lon/lat, suficiente para el tamaño de una finca. */
export function pointInRing(lat: number, lon: number, ring: GeoJsonRing): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [lonA, latA] = ring[index]!;
    const [lonB, latB] = ring[previous]!;
    if ((latA > lat) !== (latB > lat) && lon < ((lonB - lonA) * (lat - latA)) / (latB - latA) + lonA) inside = !inside;
  }
  return inside;
}

function buildPlan(centerLat: number, centerLon: number, size: number, spacingMeters: number, accepts: (lat: number, lon: number) => boolean): GridPlan {
  const half = (size - 1) / 2;
  const latStep = spacingMeters / EARTH_METERS_PER_DEGREE;
  const lonStep = spacingMeters / (EARTH_METERS_PER_DEGREE * Math.cos(radians(centerLat)));
  const locations: GridLocation[] = [];
  const included: boolean[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const location = { lat: centerLat + (half - row) * latStep, lon: centerLon + (col - half) * lonStep };
      const interior = row >= 1 && row <= size - 2 && col >= 1 && col <= size - 2;
      locations.push(location);
      included.push(interior && accepts(location.lat, location.lon));
    }
  }
  return { size, spacingMeters, locations, included };
}

/**
 * Arma la malla de consulta. Un punto usa 9×9 puntos cada 30 m (7×7 celdas, ~210 m). Un lote usa 10×10 puntos repartidos sobre su caja:
 * la celda es de 30 m salvo que el lote sea tan grande que no quepa, y entonces crece para cubrirlo. Si el lote es tan chico que
 * ninguna celda cae dentro, se mide alrededor de su centro en vez de quedarse sin dato.
 */
export function planTerrainGrid({ lat, lon, ring }: TerrainTarget): GridPlan {
  const { cellMeters, pointGridSize, polygonGridSize, minCells } = LIVE_TERRAIN;
  if (!ring) return buildPlan(lat, lon, pointGridSize, cellMeters, () => true);
  const [south, north, west, east] = bboxOfRing(ring);
  const centerLat = (south + north) / 2;
  const centerLon = (west + east) / 2;
  const span = Math.max((north - south) * EARTH_METERS_PER_DEGREE, (east - west) * EARTH_METERS_PER_DEGREE * Math.cos(radians(centerLat)));
  const spacing = Math.max(cellMeters, span / (polygonGridSize - 3));
  const inside = buildPlan(centerLat, centerLon, polygonGridSize, spacing, (cellLat, cellLon) => pointInRing(cellLat, cellLon, ring));
  return inside.included.filter(Boolean).length >= minCells ? inside : buildPlan(centerLat, centerLon, polygonGridSize, spacing, () => true);
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/**
 * Convierte las altitudes de la malla (mismo orden que `plan.locations`, null = sin dato) en altitud y pendiente del sitio:
 * pendiente de Horn en cada celda incluida, promediada, con el menor y el mayor valor para mostrar cuánto varía.
 * Devuelve null si quedan menos de `LIVE_TERRAIN.minCells` celdas con los ocho vecinos con dato.
 */
export function summarizeTerrainGrid(elevations: ReadonlyArray<number | null>, plan: GridPlan): LiveTerrain | null {
  const { size, spacingMeters, included } = plan;
  if (elevations.length !== size * size) throw new RangeError("La lista de altitudes no calza con la malla");
  const slopes: number[] = [];
  const heights: number[] = [];
  included.forEach((counts, index) => {
    const center = elevations[index];
    if (!counts || center === null || center === undefined) return;
    const around = [-1, 0, 1].map((dRow) => [-1, 0, 1].map((dCol) => elevations[index + dRow * size + dCol] ?? null));
    const slope = hornSlopeFromWindow(around, spacingMeters, spacingMeters);
    if (slope === null) return;
    slopes.push(Math.min(slope, MAX_SLOPE_PERCENT));
    heights.push(center);
  });
  if (slopes.length < LIVE_TERRAIN.minCells) return null;
  return {
    elevationMeters: Math.round(mean(heights)),
    slopePercent: oneDecimal(mean(slopes)),
    slopeRangePercent: [oneDecimal(Math.min(...slopes)), oneDecimal(Math.max(...slopes))],
    cellMeters: spacingMeters,
  };
}
