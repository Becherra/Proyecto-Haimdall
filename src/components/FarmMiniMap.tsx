"use client";

import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import { convertCoordinateOrder, squareFromArea } from "../lib/geo";
import type { Farm } from "../types";

function terrainPositions(farm: Farm): [number, number][] {
  const { terrain, centroid } = farm;
  if (terrain.kind === "polygon") return terrain.ring.map((point) => convertCoordinateOrder(point, "geojson") as [number, number]);
  if (terrain.kind === "approx_size") return squareFromArea(centroid, terrain.areaHa).map((point) => convertCoordinateOrder(point, "geojson") as [number, number]);
  return [];
}

function FitTerrain({ farm, positions }: { farm: Farm; positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    // El recuadro se monta antes de tener su tamaño final: se recalcula para que carguen las imágenes.
    const fit = () => {
      map.invalidateSize(false);
      if (positions.length >= 3) map.fitBounds(L.latLngBounds(positions), { padding: [6, 6], animate: false, maxZoom: 18 });
      else map.setView([farm.centroid.lat, farm.centroid.lon], 15, { animate: false });
    };
    fit();
    const timer = window.setTimeout(fit, 250);
    return () => window.clearTimeout(timer);
  }, [farm, map, positions]);
  return null;
}

/** Recuadro pequeño y fijo con el sitio y el terreno que la persona marcó en el mapa. */
export default function FarmMiniMap({ farm }: { farm: Farm }) {
  const positions = terrainPositions(farm);
  return <MapContainer center={[farm.centroid.lat, farm.centroid.lon]} zoom={15} className="h-full w-full" zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false} boxZoom={false}>
    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
    {positions.length >= 3 && <Polygon positions={positions} pathOptions={{ color: "#EAD39D", weight: 3, fillColor: "#EAD39D", fillOpacity: 0.3 }} />}
    <CircleMarker center={[farm.centroid.lat, farm.centroid.lon]} radius={5} pathOptions={{ color: "#0D3C16", weight: 2, fillColor: "#EAD39D", fillOpacity: 1 }} />
    <FitTerrain farm={farm} positions={positions} />
  </MapContainer>;
}
