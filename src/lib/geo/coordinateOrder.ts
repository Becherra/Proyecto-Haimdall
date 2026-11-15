import type { GeoJsonPosition } from "./geometry";

export type LeafletPosition = [latitude: number, longitude: number];

/** Converts the tuple order at the map/GeoJSON boundary: Leaflet [lat, lon] ↔ GeoJSON [lon, lat]. */
export function convertCoordinateOrder(position: LeafletPosition, source: "leaflet"): GeoJsonPosition;
export function convertCoordinateOrder(position: GeoJsonPosition, source: "geojson"): LeafletPosition;
export function convertCoordinateOrder(position: readonly [number, number], _source: "leaflet" | "geojson"): [number, number] {
  return [position[1], position[0]];
}
