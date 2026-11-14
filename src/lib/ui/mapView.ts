import type { LocationResult } from "../../types";

export type MapView = {
  targetZoom: number;
  bounds?: [[number, number], [number, number]];
  showPinHint: boolean;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function bboxZoom(location: LocationResult): number {
  const [south, north, west, east] = location.boundingBox ?? [location.lat, location.lat, location.lon, location.lon];
  const span = Math.max(north - south, east - west, 0.0001);
  return clamp(Math.floor(Math.log2(360 / span)) + 1, 12, 16);
}

/** Calcula la vista inicial según cobertura geocodificada o precisión GPS. */
export function calculateMapView(location: LocationResult, gpsAccuracyMeters?: number): MapView {
  if (gpsAccuracyMeters !== undefined) {
    const targetZoom = gpsAccuracyMeters > 1000 ? 13 : gpsAccuracyMeters > 500 ? 14 : 17;
    return { targetZoom, showPinHint: targetZoom < 14 };
  }
  if (location.boundingBox) {
    const [south, north, west, east] = location.boundingBox;
    const targetZoom = bboxZoom(location);
    return { targetZoom, bounds: [[south, west], [north, east]], showPinHint: targetZoom < 14 };
  }
  return { targetZoom: 15, showPinHint: false };
}
