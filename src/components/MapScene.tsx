"use client";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { buildGibsTileUrl, GIBS_LAYER_CONFIG, isGibsDateAvailable } from "../lib/ui/mapLayers";
import { formatCoordinates, validateMapLocation } from "../lib/ui/coordinates";
import { calculateMapView } from "../lib/ui/mapView";
import type { LocationResult } from "../types";

type MapSceneProps = { location: LocationResult; gpsAccuracyMeters?: number; onLocationSelected: (location: LocationResult) => void; onBack: () => void; onConfirmed?: () => void };
type TileState = { loading: boolean; error: string | null };

const initialDate = "2026-10-16";
const satelliteAttribution = "Tiles © Esri — Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";
const osmAttribution = '© OpenStreetMap contributors';
const nasaAttribution = "NASA GIBS";

const pinIcon = L.divIcon({ className: "heimdall-pin", html: '<span aria-hidden="true"></span>', iconSize: [24, 24], iconAnchor: [12, 12] });

function ZoomToLocation({ location, gpsAccuracyMeters }: Pick<MapSceneProps, "location" | "gpsAccuracyMeters">) {
  const map = useMap();
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view = calculateMapView(location, gpsAccuracyMeters);
    if (view.bounds) {
      map.fitBounds(view.bounds, { animate: !reducedMotion, duration: 1.2, maxZoom: view.targetZoom });
      if (map.getZoom() < 12) map.setZoom(12, { animate: !reducedMotion });
      return;
    }
    map.setView([location.lat, location.lon], 8, { animate: false });
    const timer = window.setTimeout(() => map.setZoom(view.targetZoom, { animate: !reducedMotion, duration: 1.8 }), 80);
    return () => window.clearTimeout(timer);
  }, [gpsAccuracyMeters, location, map]);
  return null;
}

function MapPinSelector({ onSelect }: { onSelect: (location: LocationResult) => void }) {
  useMapEvents({ click: (event) => onSelect(validateMapLocation(event.latlng.lat, event.latlng.lng)) });
  return null;
}

function MapZoomObserver({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => { onZoomChange(map.getZoom()); }, [map, onZoomChange]);
  useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) });
  return null;
}

export default function MapScene({ location, gpsAccuracyMeters, onLocationSelected, onBack, onConfirmed }: MapSceneProps) {
  const [draftLocation, setDraftLocation] = useState(location);
  const [opacity, setOpacity] = useState(65);
  const [date, setDate] = useState(initialDate);
  const [zoom, setZoom] = useState(8);
  const [online, setOnline] = useState(true);
  const [tiles, setTiles] = useState<TileState>({ loading: true, error: null });
  const trueColorUrl = useMemo(() => {
    try { return buildGibsTileUrl("trueColor", date); } catch { return null; }
  }, [date]);
  const ndviUrl = useMemo(() => {
    try { return buildGibsTileUrl("ndvi", date); } catch { return null; }
  }, [date]);
  const dateError = !isGibsDateAvailable("trueColor", date) && !isGibsDateAvailable("ndvi", date)
    ? "NASA GIBS no tiene datos para esta fecha. Elige una fecha entre 2025-11-10 y 2026-10-16."
    : null;
  const trueColorError = !trueColorUrl && !dateError ? "Color real NASA GIBS no tiene datos para esta fecha." : null;
  const ndviError = !ndviUrl && !dateError ? "NDVI NASA GIBS no tiene datos para esta fecha; las demás capas siguen disponibles." : null;
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  const onTileLoad = () => setTiles({ loading: false, error: null });
  const onTileError = () => setTiles({ loading: false, error: "No se pudieron cargar las teselas. Revisa tu conexión o cambia la fecha." });

  return <section className="relative w-full" aria-label="Mapa de ubicación de la finca">
    {!online && <p className="mb-3 rounded-lg border border-amber-300/40 bg-amber-950/60 p-3 text-sm text-amber-100" role="status">Sin conexión: las teselas nuevas pueden no estar disponibles.</p>}
    {tiles.loading && <p className="mb-3 rounded-lg border border-cyan-300/30 bg-cyan-950/50 p-3 text-sm text-cyan-100" role="status">Cargando teselas del mapa…</p>}
    {tiles.error && <p className="mb-3 rounded-lg border border-red-300/40 bg-red-950/60 p-3 text-sm text-red-100" role="alert">{tiles.error}</p>}
    {dateError && <p className="mb-3 rounded-lg border border-amber-300/40 bg-amber-950/60 p-3 text-sm text-amber-100" role="alert">{dateError}</p>}
    {trueColorError && <p className="mb-3 rounded-lg border border-amber-300/40 bg-amber-950/60 p-3 text-sm text-amber-100" role="alert">{trueColorError}</p>}
    {ndviError && <p className="mb-3 rounded-lg border border-amber-300/40 bg-amber-950/60 p-3 text-sm text-amber-100" role="alert">{ndviError}</p>}
    <div className="relative h-[min(38vh,280px)] min-h-[235px] overflow-hidden rounded-xl border border-white/15 sm:h-[min(58vh,520px)] sm:min-h-[360px]">
      <MapContainer center={[location.lat, location.lon]} zoom={8} scrollWheelZoom className="h-full w-full" zoomControl>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satélite">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={23} attribution={satelliteAttribution} eventHandlers={{ load: onTileLoad, tileerror: onTileError }} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Calles">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution={osmAttribution} eventHandlers={{ load: onTileLoad, tileerror: onTileError }} />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Color real · NASA GIBS">
            {trueColorUrl && <TileLayer url={trueColorUrl} maxZoom={GIBS_LAYER_CONFIG.trueColor.maxZoom} opacity={opacity / 100} attribution={nasaAttribution} eventHandlers={{ load: onTileLoad, tileerror: onTileError }} />}
          </LayersControl.Overlay>
          <LayersControl.Overlay name="NDVI · NASA GIBS">
            {ndviUrl && <TileLayer url={ndviUrl} maxZoom={GIBS_LAYER_CONFIG.ndvi.maxZoom} opacity={opacity / 100} attribution={nasaAttribution} eventHandlers={{ load: onTileLoad, tileerror: onTileError }} />}
          </LayersControl.Overlay>
        </LayersControl>
        <ZoomToLocation location={location} gpsAccuracyMeters={gpsAccuracyMeters} />
        <MapZoomObserver onZoomChange={setZoom} />
        <MapPinSelector onSelect={setDraftLocation} />
        <Marker position={[draftLocation.lat, draftLocation.lon]} icon={pinIcon} draggable eventHandlers={{ dragend: (event) => { const marker = event.target as L.Marker; const point = marker.getLatLng(); setDraftLocation(validateMapLocation(point.lat, point.lng)); } }} title="Pin de la finca" />
        <CircleMarker center={[draftLocation.lat, draftLocation.lon]} radius={8} pathOptions={{ color: "#fbbf24", fillColor: "#fbbf24", fillOpacity: 0.25 }} />
        {gpsAccuracyMeters !== undefined && <Circle center={[draftLocation.lat, draftLocation.lon]} radius={gpsAccuracyMeters} pathOptions={{ color: "#67e8f9", fillColor: "#67e8f9", fillOpacity: 0.12 }} />}
      </MapContainer>
    </div>
    <div className="sticky bottom-0 z-20 mt-3 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border-t border-white/15 bg-black/95 p-3 text-left backdrop-blur sm:mt-4 sm:grid-cols-[1fr_auto] sm:p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-saffron-spark">Finca seleccionada</p>
        <p className="mt-2 text-base font-semibold text-white">{draftLocation.label}</p>
        <p className="mt-1 text-sm text-slate-300">{formatCoordinates(draftLocation)}</p>
        <p className="mt-2 text-xs text-slate-400">Haz click en el mapa o arrastra el pin para ajustar la ubicación.</p>
      </div>
      <div className="flex min-w-32 flex-col gap-2 sm:min-w-44">
        <label htmlFor="gibs-date" className="text-xs font-semibold text-slate-300">Fecha NASA GIBS</label>
        <input id="gibs-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setTiles({ loading: true, error: null }); }} className="rounded-lg border border-white/20 bg-black px-3 py-2 text-sm text-white outline-none focus:border-saffron-spark focus:ring-2 focus:ring-saffron-spark/50" />
        <label htmlFor="gibs-opacity" className="text-xs font-semibold text-slate-300">Opacidad de capas: {opacity}%</label>
        <input id="gibs-opacity" type="range" min="0" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="accent-[#8052ff]" />
      </div>
      <p className="col-span-2 text-xs leading-5 text-slate-400">Capa NASA: resolución regional (cientos de metros), no representa el detalle del lote.</p>
      <div className="col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} className="rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-saffron-spark focus:outline-none focus:ring-2 focus:ring-saffron-spark">Volver al globo</button>
        <button type="button" onClick={() => { onLocationSelected(draftLocation); onConfirmed?.(); }} className="rounded-full bg-electric-iris px-4 py-3 text-sm font-semibold text-white hover:bg-[#916dff] focus:outline-none focus:ring-2 focus:ring-saffron-spark">Confirmar finca</button>
      </div>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">Atribuciones: {osmAttribution} · {satelliteAttribution} · {nasaAttribution}.</p>
    {gpsAccuracyMeters !== undefined && gpsAccuracyMeters > 1000 && <p className="mt-1 text-xs text-amber-200">La precisión del GPS es aproximada ({Math.round(gpsAccuracyMeters)} m); ajusta el pin manualmente.</p>}
    {zoom < 14 && <p className="mt-1 text-xs text-amber-200">Toca el mapa donde queda tu finca.</p>}
  </section>;
}
