/** Punto en píxeles del contenedor del mapa: [x, y]. */
export type PixelPoint = readonly [x: number, y: number];

const MIN_STROKE_POINTS = 8;
const MAX_LASSO_VERTICES = 40;
const BASE_TOLERANCE_PX = 6;

function cross(o: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Punto donde se cruzan dos segmentos, o null si no se cruzan. */
function intersection(a: PixelPoint, b: PixelPoint, c: PixelPoint, d: PixelPoint): PixelPoint | null {
  const denominator = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (denominator === 0) return null;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / denominator;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function distanceToLine(point: PixelPoint, start: PixelPoint, end: PixelPoint): number {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (length === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return Math.abs(cross(start, end, point)) / length;
}

/** Douglas–Peucker: reduce un trazo a pocos vértices sin cambiar su forma visible. */
export function simplifyPath(points: readonly PixelPoint[], tolerancePx: number): PixelPoint[] {
  if (points.length < 3) return [...points];
  const first = points[0] as PixelPoint;
  const last = points[points.length - 1] as PixelPoint;
  let farthest = 0;
  let farthestIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToLine(points[index] as PixelPoint, first, last);
    if (distance > farthest) { farthest = distance; farthestIndex = index; }
  }
  if (farthest <= tolerancePx) return [first, last];
  const left = simplifyPath(points.slice(0, farthestIndex + 1), tolerancePx);
  const right = simplifyPath(points.slice(farthestIndex), tolerancePx);
  return [...left.slice(0, -1), ...right];
}

/** Si el dedo cruzó su propio trazo (sobrepasó el inicio), conserva solo el lazo cerrado. */
export function trimLassoLoop(points: readonly PixelPoint[]): PixelPoint[] {
  for (let index = 3; index < points.length; index += 1) {
    const a = points[index - 1] as PixelPoint;
    const b = points[index] as PixelPoint;
    for (let earlier = 0; earlier < index - 2; earlier += 1) {
      const crossing = intersection(points[earlier] as PixelPoint, points[earlier + 1] as PixelPoint, a, b);
      if (crossing) return [crossing, ...points.slice(earlier + 1, index)];
    }
  }
  return [...points];
}

/**
 * Convierte el trazo libre del dedo en un polígono de pocos vértices (sin cerrar: el último
 * se une al primero). Devuelve null si el trazo es demasiado corto para ser un terreno.
 */
export function buildLassoPolygon(stroke: readonly PixelPoint[]): PixelPoint[] | null {
  if (stroke.length < MIN_STROKE_POINTS) return null;
  const loop = trimLassoLoop(stroke);
  let tolerance = BASE_TOLERANCE_PX;
  let polygon = simplifyPath(loop, tolerance);
  while (polygon.length > MAX_LASSO_VERTICES) { tolerance *= 1.5; polygon = simplifyPath(loop, tolerance); }
  return polygon.length >= 3 ? polygon : null;
}
