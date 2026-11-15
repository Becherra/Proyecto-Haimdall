"use client";

import L from "leaflet";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Circle, CircleMarker, LayersControl, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { convertCoordinateOrder, squareFromArea } from "../lib/geo";
import { buildGibsTileUrl, GIBS_LAYER_CONFIG, isGibsDateAvailable } from "../lib/ui/mapLayers";
import { formatCoordinates, validateMapLocation } from "../lib/ui/coordinates";
import { calculateMapView } from "../lib/ui/mapView";
import { buildFarmFromEditor, createTerrainEditor, getTerrainEditorStatus, requiresGpsPinAdjustment, terrainEditorReducer } from "../lib/ui/terrainEditor";
import { validateFarmDraft } from "../lib/geo/farmValidation";
import type { AreaRangeHa, TerrainEditorMode } from "../lib/ui/terrainEditor";
import { APPROXIMATE_AREA_RANGES_HA, FOOTBALL_PITCH_AREA_HA } from "../lib/geo/limits";
import type { Farm, LocationResult } from "../types";

type MapSceneProps = { location: LocationResult; gpsAccuracyMeters?: number; onBack: () => void; onFarmConfirmed: (farm: Farm) => void; debugMode?: boolean };
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

function MapPinSelector({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  const dragging = useRef(false);
  useMapEvents({
    dragstart: () => { dragging.current = true; },
    dragend: () => { dragging.current = false; },
    click: (event) => { if (!dragging.current) onSelect(event.latlng.lat, event.latlng.lng); },
  });
  return null;
}

function MapZoomObserver({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => { onZoomChange(map.getZoom()); }, [map, onZoomChange]);
  useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) });
  return null;
}

export default function MapScene({ location, gpsAccuracyMeters, onBack, onFarmConfirmed, debugMode = false }: MapSceneProps) {
  const [editor, dispatch] = useReducer(terrainEditorReducer, location, (initial) => createTerrainEditor(initial, gpsAccuracyMeters === undefined ? "search" : "gps", gpsAccuracyMeters));
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirmedFarm, setConfirmedFarm] = useState<Farm | null>(null);
  const draftLocation = editor.location;
  const terrainStatus = getTerrainEditorStatus(editor);
  const currentFarm = buildFarmFromEditor(editor);
  const showConfirmedFarm = confirmedFarm !== null && JSON.stringify(currentFarm) === JSON.stringify(confirmedFarm);
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
  const approximateRing = useMemo(() => {
    if (editor.mode !== "approx_size" || terrainStatus.areaHa === null || !terrainStatus.canConfirm) return null;
    try { return squareFromArea(draftLocation, terrainStatus.areaHa); } catch { return null; }
  }, [draftLocation, editor.mode, terrainStatus.areaHa, terrainStatus.canConfirm]);
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
    {!online && <p className="mb-3 rounded-lg border border-cream/40 bg-cream/15 p-3 text-sm text-cream" role="status">Sin conexión: las teselas nuevas pueden no estar disponibles.</p>}
    {tiles.loading && <p className="mb-3 rounded-lg border border-spruce/30 bg-spruce/50 p-3 text-sm text-bone-white" role="status">Cargando teselas del mapa…</p>}
    {tiles.error && <p className="mb-3 rounded-lg border border-clay/40 bg-clay/60 p-3 text-sm text-clay-light" role="alert">{tiles.error}</p>}
    {dateError && <p className="mb-3 rounded-lg border border-cream/40 bg-cream/15 p-3 text-sm text-cream" role="alert">{dateError}</p>}
    {trueColorError && <p className="mb-3 rounded-lg border border-cream/40 bg-cream/15 p-3 text-sm text-cream" role="alert">{trueColorError}</p>}
    {ndviError && <p className="mb-3 rounded-lg border border-cream/40 bg-cream/15 p-3 text-sm text-cream" role="alert">{ndviError}</p>}
    <div className="relative h-[min(38svh,280px)] min-h-[220px] overflow-hidden rounded-xl border border-cream/15 sm:h-[min(58svh,520px)] sm:min-h-[360px]">
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
        <MapPinSelector onSelect={(lat, lon) => {
          if (editor.mode === "polygon") dispatch({ type: "add-vertex", lat, lon });
          else dispatch({ type: "set-location", location: validateMapLocation(lat, lon, draftLocation.label) });
        }} />
        {approximateRing && <Polygon positions={approximateRing.map((point) => convertCoordinateOrder(point, "geojson"))} pathOptions={{ color: "#EAD39D", weight: 2, fillColor: "#EAD39D", fillOpacity: 0.12 }} />}
        {editor.mode === "polygon" && editor.vertices.length >= 3 && <Polygon positions={editor.vertices.map((point) => convertCoordinateOrder(point, "geojson"))} pathOptions={{ color: "#EAD39D", weight: 2, fillColor: "#EAD39D", fillOpacity: 0.12, dashArray: editor.polygonFinished ? undefined : "6 6" }} />}
        {editor.mode === "polygon" && editor.vertices.map((point, index) => <Marker key={`vertex-${index}`} position={convertCoordinateOrder(point, "geojson")} icon={pinIcon} draggable eventHandlers={{ dragend: (event) => { const marker = event.target as L.Marker; const moved = marker.getLatLng(); dispatch({ type: "move-vertex", index, lat: moved.lat, lon: moved.lng }); } }} title={`Vértice ${index + 1}`} />)}
        <Marker position={[draftLocation.lat, draftLocation.lon]} icon={pinIcon} draggable={editor.mode !== "polygon" || requiresGpsPinAdjustment(editor)} eventHandlers={{ dragend: (event) => { const marker = event.target as L.Marker; const point = marker.getLatLng(); dispatch({ type: "set-location", location: validateMapLocation(point.lat, point.lng, draftLocation.label), locationSource: "map" }); }} } title="Pin de la finca" />
        <CircleMarker center={[draftLocation.lat, draftLocation.lon]} radius={8} pathOptions={{ color: "#EAD39D", fillColor: "#EAD39D", fillOpacity: 0.25 }} />
        {gpsAccuracyMeters !== undefined && <Circle center={[draftLocation.lat, draftLocation.lon]} radius={gpsAccuracyMeters} pathOptions={{ color: "#B5C266", fillColor: "#B5C266", fillOpacity: 0.12 }} />}
      </MapContainer>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-[1000] mx-auto grid max-h-[40svh] max-w-[1440px] grid-cols-[1fr_auto] gap-3 overflow-y-auto border-t border-cream/15 bg-meadow/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-left shadow-[0_-12px_36px_rgba(0,0,0,0.6)] backdrop-blur sm:grid-cols-[1fr_auto] sm:p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream">Finca seleccionada</p>
        <p className="mt-2 text-base font-semibold text-bone-white">{draftLocation.label}</p>
        <p className="mt-1 text-sm text-silver-mist">{formatCoordinates(draftLocation)}</p>
        <p className="mt-2 text-xs text-ash-gray">{editor.mode === "polygon" ? "Toca el mapa para añadir vértices; arrástralos para ajustar." : "Toca el mapa o arrastra el pin para ajustar la ubicación."}</p>
      </div>
      <div className="flex min-w-28 flex-col gap-2 sm:min-w-44">
        <label htmlFor="gibs-date" className="text-xs font-semibold text-silver-mist">Fecha NASA GIBS</label>
        <input id="gibs-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setTiles({ loading: true, error: null }); }} className="rounded-lg border border-cream/20 bg-meadow px-3 py-2 text-sm text-bone-white outline-none focus:border-cream focus:ring-2 focus:ring-cream/50" />
        <label htmlFor="gibs-opacity" className="text-xs font-semibold text-silver-mist">Opacidad de capas: {opacity}%</label>
        <input id="gibs-opacity" type="range" min="0" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="accent-[#737F35]" />
      </div>
      <p className="col-span-2 text-xs leading-5 text-ash-gray">NASA POWER representa clima regional según la resolución de cada producto; no mide el detalle del lote.</p>
      <fieldset className="col-span-2 min-w-0">
        <legend className="mb-2 text-sm font-semibold text-bone-white">Define el terreno (opcional)</legend>
        <div role="radiogroup" aria-label="Tipo de terreno" className="grid grid-cols-3 gap-2">
          {([
            ["point", "Solo el punto"], ["approx_size", "Tamaño aproximado"], ["polygon", "Dibujar el terreno"],
          ] as const satisfies readonly (readonly [TerrainEditorMode, string])[]).map(([mode, label]) => (
            <label key={mode} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-medium focus-within:ring-2 focus-within:ring-cream sm:text-sm ${editor.mode === mode ? "border-cream bg-cream/15 text-bone-white" : "border-cream/20 text-silver-mist"}`}>
              <input className="sr-only" type="radio" name="terrain-mode" value={mode} checked={editor.mode === mode} onChange={() => dispatch({ type: "set-mode", mode })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {editor.mode === "approx_size" && <div className="col-span-2 space-y-3">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-silver-mist">Elige un rango</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {APPROXIMATE_AREA_RANGES_HA.map((range) => {
              const label = range[0] === 0.01 ? "Menos de 1 ha" : range[0] === 20 ? "Más de 20 ha" : `${range[0]}–${range[1]} ha`;
              const selected = editor.areaRangeHa?.[0] === range[0] && editor.areaRangeHa[1] === range[1];
              return <label key={label} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center text-xs focus-within:ring-2 focus-within:ring-cream ${selected ? "border-cream bg-cream/15 text-bone-white" : "border-cream/20 text-silver-mist"}`}>
                <input className="sr-only" type="radio" name="terrain-area-range" checked={selected} onChange={() => dispatch({ type: "set-area-range", range: range as AreaRangeHa })} />
                {label}
              </label>;
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div>
            <label htmlFor="terrain-area" className="mb-1 block text-xs font-medium text-silver-mist">O escribe el área exacta</label>
            <input id="terrain-area" type="number" min="0" step="any" value={editor.exactAreaHa === null ? "" : editor.areaUnit === "m2" ? editor.exactAreaHa * 10_000 : editor.exactAreaHa} onChange={(event) => dispatch({ type: "set-exact-area", value: event.target.value === "" ? null : Number(event.target.value), unit: editor.areaUnit })} className="min-h-11 w-full rounded-lg border border-cream/20 bg-meadow px-3 text-sm text-bone-white outline-none focus:border-cream focus:ring-2 focus:ring-cream/50" />
          </div>
          <div>
            <label htmlFor="terrain-area-unit" className="mb-1 block text-xs font-medium text-silver-mist">Unidad</label>
            <select id="terrain-area-unit" value={editor.areaUnit} onChange={(event) => dispatch({ type: "set-area-unit", unit: event.target.value as "ha" | "m2" })} className="min-h-11 rounded-lg border border-cream/20 bg-meadow px-3 text-sm text-bone-white outline-none focus:border-cream focus:ring-2 focus:ring-cream/50"><option value="ha">ha</option><option value="m2">m²</option></select>
          </div>
        </div>
      </div>}
      {editor.mode === "polygon" && <div className="col-span-2 flex flex-wrap gap-2">
        <button type="button" disabled={editor.vertices.length === 0} onClick={() => dispatch({ type: "undo" })} className="min-h-11 rounded-full border border-cream/25 px-4 text-sm font-semibold text-bone-white hover:border-cream focus-visible:outline-2 focus-visible:outline-cream disabled:opacity-40">Deshacer</button>
        <button type="button" disabled={editor.vertices.length === 0} onClick={() => dispatch({ type: "clear" })} className="min-h-11 rounded-full border border-cream/25 px-4 text-sm font-semibold text-bone-white hover:border-cream focus-visible:outline-2 focus-visible:outline-cream disabled:opacity-40">Borrar</button>
        <button type="button" disabled={editor.vertices.length < 3} onClick={() => dispatch({ type: "finish" })} className="min-h-11 rounded-full border border-cream/70 px-4 text-sm font-semibold text-cream hover:bg-cream/10 focus-visible:outline-2 focus-visible:outline-cream disabled:opacity-40">Terminar</button>
      </div>}
      {editor.mode === "polygon" && <p className="col-span-2 rounded-lg border border-cream/20 bg-cream/5 p-3 text-xs leading-5 text-bone-white" role="note">
        Toca el mapa para marcar el contorno (mínimo 3 puntos). Puedes arrastrar cada punto y usar «Deshacer» o «Borrar». Cuando termines, pulsa «Terminar» para cerrar y validar el área; después podrás confirmar la finca.
      </p>}
      {terrainStatus.areaHa !== null && <p className="col-span-2 text-sm text-bone-white">Área: {terrainStatus.areaHa.toFixed(2)} ha{terrainStatus.areaHa >= FOOTBALL_PITCH_AREA_HA ? ` · ≈ ${Math.round(terrainStatus.areaHa / FOOTBALL_PITCH_AREA_HA)} canchas de fútbol` : ""}</p>}
      {editor.mode === "polygon" && terrainStatus.areaHa === null && <p className="col-span-2 text-xs text-silver-mist">Añade al menos tres puntos para calcular el área. La vía accesible para indicar el tamaño es el modo aproximado con campo numérico.</p>}
      {(editor.error ?? terrainStatus.error) && <p className="col-span-2 text-sm text-cream" role="alert">{editor.error ?? terrainStatus.error}</p>}
      {terrainStatus.warnings.map((warning) => <p key={warning} className="col-span-2 text-sm text-cream" role="alert">{warning}</p>)}
      <div className="col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} className="min-h-11 rounded-full border border-cream/20 px-4 py-3 text-sm font-semibold text-bone-white hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream">Volver al globo</button>
        <button type="button" aria-describedby={!terrainStatus.canConfirm ? "farm-confirm-guidance" : undefined} disabled={!terrainStatus.canConfirm} onClick={() => {
          const candidate = buildFarmFromEditor(editor);
          if (!candidate) { setConfirmationError(terrainStatus.error ?? "Completa y valida el terreno antes de confirmar."); return; }
          const result = validateFarmDraft(candidate);
          if (!result.valid) { setConfirmationError(result.errors.join(" ")); return; }
          setConfirmationError(null); setConfirmedFarm(result.farm); onFarmConfirmed(result.farm);
        }} className="min-h-11 rounded-full bg-olive px-4 py-3 text-sm font-semibold text-bone-white hover:bg-[#8A9742] focus:outline-none focus:ring-2 focus:ring-cream disabled:cursor-not-allowed disabled:opacity-40">Confirmar finca</button>
      </div>
      {!terrainStatus.canConfirm && <p id="farm-confirm-guidance" className="col-span-2 -mt-1 text-xs leading-5 text-cream" role="status">Antes de confirmar: {terrainStatus.error ?? "Completa y valida el terreno."}</p>}
      {confirmationError && <p className="col-span-2 text-sm text-clay-light" role="alert">No se pudo confirmar la finca: {confirmationError}</p>}
      {showConfirmedFarm && confirmedFarm && debugMode && <details className="col-span-2 rounded-lg border border-cream/15 p-3 text-xs text-bone-white"><summary className="cursor-pointer font-semibold">Farm enviado (depuración)</summary><pre className="mt-2 overflow-auto">{JSON.stringify(confirmedFarm, null, 2)}</pre></details>}
      <p className="col-span-2 text-xs leading-5 text-ash-gray">Atribuciones: {osmAttribution} · {satelliteAttribution} · {nasaAttribution}.</p>
    </div>
    {gpsAccuracyMeters !== undefined && gpsAccuracyMeters > 1000 && <p className="mt-1 text-xs text-cream">La precisión del GPS es aproximada ({Math.round(gpsAccuracyMeters)} m); ajusta el pin manualmente.</p>}
    {zoom < 14 && <p className="mt-1 text-xs text-cream">Toca el mapa donde queda tu finca.</p>}
  </section>;
}
