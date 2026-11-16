import { GLOBE_RELIEF } from "../config";
import { locationResultSchema, type LocationResult } from "../../types";

export type Vec3 = { x: number; y: number; z: number };
export type GeoPoint = { lat: number; lon: number };
export type Ray = { origin: Vec3; direction: Vec3 };
/** Rejilla equirectangular de elevación (fila 0 = norte, columna 0 = 180° O); `stride` salta canales RGBA de un ImageData. */
export type ElevationGrid = { values: ArrayLike<number>; width: number; height: number; stride?: number; maxValue?: number };
export type ReliefSurface = { radius: number; maxHeight: number; heightAt: (point: GeoPoint) => number };

export const GLOBE_PICK_LABEL = "Zona elegida en el globo";

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const along = (ray: Ray, t: number): Vec3 => ({ x: ray.origin.x + ray.direction.x * t, y: ray.origin.y + ray.direction.y * t, z: ray.origin.z + ray.direction.z * t });
const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Lleva cualquier longitud al rango [-180, 180). */
export function normalizeLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Lat/lon → posición 3D con la misma convención de three-globe (lat 0, lon 0 mira a +Z; el norte es +Y; el este, +X).
 */
export function geoToCartesian({ lat, lon }: GeoPoint, radius: number): Vec3 {
  const phi = toRad(90 - lat);
  const theta = toRad(90 - lon);
  return { x: radius * Math.sin(phi) * Math.cos(theta), y: radius * Math.cos(phi), z: radius * Math.sin(phi) * Math.sin(theta) };
}

/** Posición 3D (centro del globo en el origen) → lat/lon. Es la inversa de `geoToCartesian` y no depende del radio. */
export function cartesianToGeo(point: Vec3): GeoPoint {
  const r = length(point);
  if (!Number.isFinite(r) || r === 0) throw new Error("El punto no puede estar en el centro del globo.");
  const lat = 90 - toDeg(Math.acos(clamp(point.y / r, -1, 1)));
  const lon = normalizeLongitude(90 - toDeg(Math.atan2(point.z, point.x)));
  return { lat, lon };
}

/** Distancias (t) a las que el rayo entra y sale de una esfera centrada en el origen, o null si no la toca. */
export function intersectRaySphere(ray: Ray, radius: number): { near: number; far: number } | null {
  const dirLength = length(ray.direction);
  if (dirLength === 0) return null;
  const d = { x: ray.direction.x / dirLength, y: ray.direction.y / dirLength, z: ray.direction.z / dirLength };
  const b = dot(ray.origin, d);
  const c = dot(ray.origin, ray.origin) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const far = (-b + root) / dirLength;
  if (far < 0) return null;
  return { near: Math.max(0, (-b - root) / dirLength), far };
}

/**
 * Elevación relativa (0–1) en un punto, interpolada entre los 4 píxeles vecinos.
 * La longitud da la vuelta (180° O y 180° E son el mismo borde); la latitud se recorta a los polos.
 */
export function sampleElevation(grid: ElevationGrid, { lat, lon }: GeoPoint): number {
  const { values, width, height, stride = 1, maxValue = 255 } = grid;
  if (width <= 0 || height <= 0 || values.length < width * height * stride) return 0;
  const x = ((normalizeLongitude(lon) + 180) / 360) * width - 0.5;
  const y = clamp(((90 - lat) / 180) * height - 0.5, 0, height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (col: number, row: number) => Number(values[(clamp(row, 0, height - 1) * width + ((col % width) + width) % width) * stride]) || 0;
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return clamp((top * (1 - fy) + bottom * fy) / maxValue, 0, 1);
}

/**
 * Punto del relieve que tocó el rayo de la cámara. El globo se dibuja con las montañas levantadas, así que cortar solo
 * contra la esfera lisa movería el toque hacia "detrás" de una cordillera vista de lado: avanzamos por el rayo desde la
 * cáscara exterior hasta encontrar el primer punto bajo la superficie y lo afinamos por bisección.
 */
export function pickReliefPoint(ray: Ray, surface: ReliefSurface, marchSteps: number = GLOBE_RELIEF.pickMarchSteps, refineSteps: number = GLOBE_RELIEF.pickRefineSteps): GeoPoint | null {
  const outer = intersectRaySphere(ray, surface.radius + surface.maxHeight);
  if (!outer) return null;
  const inner = intersectRaySphere(ray, surface.radius);
  const end = inner ? inner.near : outer.far;
  const isBelowSurface = (t: number) => {
    const point = along(ray, t);
    const r = length(point);
    return r === 0 || r <= surface.radius + surface.maxHeight * clamp(surface.heightAt(cartesianToGeo(point)), 0, 1);
  };
  const steps = Math.max(1, Math.round(marchSteps));
  let previous = outer.near;
  for (let step = 1; step <= steps; step += 1) {
    const t = outer.near + ((end - outer.near) * step) / steps;
    if (isBelowSurface(t)) return cartesianToGeo(along(ray, bisect(previous, t, isBelowSurface, refineSteps)));
    previous = t;
  }
  // Solo pasa si el rayo roza la cáscara de las montañas sin tocar ninguna.
  return null;
}

function bisect(above: number, below: number, isBelowSurface: (t: number) => boolean, steps: number): number {
  let low = above;
  let high = below;
  for (let i = 0; i < steps; i += 1) {
    const middle = (low + high) / 2;
    if (isBelowSurface(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/**
 * Convierte el punto tocado en una ubicación para el mapa detallado: coordenadas recortadas a 5 decimales (~1 m) y una
 * zona de ±`pickBoxDegrees` para que el mapa abra con contexto alrededor, no pegado a un solo lote.
 */
export function buildGlobePickLocation(point: GeoPoint, boxDegrees: number = GLOBE_RELIEF.pickBoxDegrees): LocationResult {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) throw new Error("El punto tocado no tiene coordenadas válidas.");
  const lat = round(clamp(point.lat, -90, 90), 5);
  const lon = round(normalizeLongitude(point.lon), 5);
  const box = Math.max(0, boxDegrees);
  return locationResultSchema.parse({
    lat,
    lon,
    label: GLOBE_PICK_LABEL,
    boundingBox: [Math.max(-90, lat - box), Math.min(90, lat + box), Math.max(-180, lon - box), Math.min(180, lon + box)].map((edge) => round(edge, 5)),
  });
}
