"use client";

import L from "leaflet";
import { useEffect, useReducer, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import Logo from "./Logo";
import { buildLassoPolygon, convertCoordinateOrder } from "../lib/geo";
import type { PixelPoint } from "../lib/geo";
import { validateMapLocation } from "../lib/ui/coordinates";
import { calculateMapView } from "../lib/ui/mapView";
import { buildFarmFromEditor, createTerrainEditor, getTerrainEditorStatus, terrainEditorReducer } from "../lib/ui/terrainEditor";
import { validateFarmDraft } from "../lib/geo/farmValidation";
import type { Farm, LocationResult } from "../types";

type MapSceneProps = { location: LocationResult; gpsAccuracyMeters?: number; onBack: () => void; onFarmConfirmed: (farm: Farm) => void };

const satelliteAttribution = "© Esri · OpenStreetMap";
const TUTORIAL_MS = 6400;
const TUTORIAL_STEP_MS = 3000;
const MIN_STEP_PX = 3;

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

type LassoDrawerProps = { onStart: () => void; onComplete: (points: [number, number][] | null) => void };

/**
 * Dibujo a mano alzada: un dedo traza el lazo alrededor del terreno; dos dedos (pellizco) mueven el mapa.
 * Se usan eventos nativos porque Leaflet no expone el gesto de un solo dedo cuando el arrastre está apagado.
 */
function LassoDrawer({ onStart, onComplete }: LassoDrawerProps) {
  const map = useMap();
  const [trail, setTrail] = useState<[number, number][]>([]);
  const callbacks = useRef({ onStart, onComplete });
  useEffect(() => { callbacks.current = { onStart, onComplete }; });

  useEffect(() => {
    const container = map.getContainer();
    const pointers = new Set<number>();
    let stroke: PixelPoint[] = [];
    let drawingId: number | null = null;
    let panning: { id: number; x: number; y: number } | null = null;
    map.dragging.disable();
    container.style.touchAction = "none";

    const cancel = () => { stroke = []; drawingId = null; setTrail([]); };
    const toPixel = (event: PointerEvent): PixelPoint => { const point = map.mouseEventToContainerPoint(event); return [point.x, point.y]; };

    const onDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      if (pointers.size > 1) { cancel(); return; }
      const target = event.target as HTMLElement;
      if (event.pointerType === "mouse" && event.button === 2) { panning = { id: event.pointerId, x: event.clientX, y: event.clientY }; return; }
      if (event.button !== 0 || target.closest(".leaflet-marker-icon, .leaflet-control")) return;
      drawingId = event.pointerId;
      stroke = [toPixel(event)];
      callbacks.current.onStart();
    };
    const onMove = (event: PointerEvent) => {
      // Computador: clic derecho sostenido arrastra el mapa.
      if (panning && event.pointerId === panning.id) {
        map.panBy([panning.x - event.clientX, panning.y - event.clientY], { animate: false });
        panning = { id: panning.id, x: event.clientX, y: event.clientY };
        return;
      }
      if (event.pointerId !== drawingId) return;
      const point = toPixel(event);
      const last = stroke[stroke.length - 1] as PixelPoint;
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_STEP_PX) return;
      stroke.push(point);
      setTrail(stroke.map(([x, y]) => { const latLng = map.containerPointToLatLng([x, y]); return [latLng.lat, latLng.lng]; }));
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (panning && event.pointerId === panning.id) { panning = null; return; }
      if (event.pointerId !== drawingId) return;
      const polygon = buildLassoPolygon(stroke);
      cancel();
      callbacks.current.onComplete(polygon ? polygon.map(([x, y]) => { const latLng = map.containerPointToLatLng([x, y]); return [latLng.lat, latLng.lng] as [number, number]; }) : null);
    };

    const onContextMenu = (event: Event) => event.preventDefault();
    container.addEventListener("contextmenu", onContextMenu);
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    return () => {
      container.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      map.dragging.enable();
    };
  }, [map]);

  return trail.length > 1 ? <Polyline positions={trail} pathOptions={{ color: "#EAD39D", weight: 5, opacity: 0.95 }} /> : null;
}

/** Tutorial solo visual, en dos pasos: 1) un dedo rodea el terreno; 2) dos dedos mueven el mapa. */
function LassoTutorial() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setStep(1), TUTORIAL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const loop = "M 28 58 C 22 34, 52 20, 72 32 C 90 44, 80 74, 56 78 C 38 81, 30 70, 28 58 Z";
  const drag = "M 38 62 L 66 38";
  return <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-meadow/35" aria-hidden="true">
    <svg viewBox="0 0 100 100" className="h-3/4 max-h-80 w-3/4 max-w-80">
      {step === 0 ? <g key="lasso">
        <path d={loop} fill="none" stroke="rgb(234 211 157 / 0.25)" strokeWidth="2" strokeDasharray="1 3" strokeLinecap="round" />
        <path className="lasso-tutorial-stroke" d={loop} fill="rgb(234 211 157 / 0.18)" stroke="#EAD39D" strokeWidth="3" strokeLinecap="round" pathLength="1" />
        <g className="lasso-tutorial-finger">
          <circle r="7" fill="#EAD39D" opacity="0.35" />
          <circle r="3.5" fill="#EAD39D" />
          <animateMotion dur="2.6s" repeatCount="indefinite" path={loop} />
        </g>
      </g> : <g key="pan">
        <path d={drag} fill="none" stroke="rgb(234 211 157 / 0.5)" strokeWidth="2.5" strokeDasharray="1 4" strokeLinecap="round" />
        <path d="M 60 36 L 68 36 L 68 44" fill="none" stroke="#EAD39D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <g className="lasso-tutorial-finger">
          <g><circle r="7" fill="#EAD39D" opacity="0.35" /><circle r="3.5" fill="#EAD39D" /></g>
          <g transform="translate(15 6)"><circle r="7" fill="#EAD39D" opacity="0.35" /><circle r="3.5" fill="#EAD39D" /></g>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={drag} />
        </g>
      </g>}
    </svg>
  </div>;
}

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ArrowLeft = () => <svg {...iconProps} className="h-8 w-8"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
const Restart = () => <svg {...iconProps} className="h-8 w-8"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>;
const ArrowRight = () => <svg {...iconProps} className="h-10 w-10" strokeWidth={3}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export default function MapScene({ location, gpsAccuracyMeters, onBack, onFarmConfirmed }: MapSceneProps) {
  const [initialEditor] = useState(() => createTerrainEditor(location, gpsAccuracyMeters === undefined ? "search" : "gps", gpsAccuracyMeters));
  const [editor, dispatch] = useReducer(terrainEditorReducer, initialEditor);
  const [showTutorial, setShowTutorial] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const status = getTerrainEditorStatus(editor);
  const draft = editor.location;
  const isPolygon = editor.mode === "polygon";

  useEffect(() => {
    const timer = window.setTimeout(() => setShowTutorial(false), TUTORIAL_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const onLasso = (points: [number, number][] | null) => {
    if (!points) { setMessage("Rodea todo tu terreno con el dedo"); return; }
    setMessage(null);
    dispatch({ type: "set-polygon", points });
  };
  const reset = () => { dispatch({ type: "reset", initial: initialEditor }); setMessage(null); setShowTutorial(true); };
  const confirm = () => {
    const candidate = buildFarmFromEditor(editor);
    const result = candidate ? validateFarmDraft(candidate) : null;
    if (!result?.valid) { setMessage(result?.errors.join(" ") ?? status.error ?? "Rodea tu terreno otra vez"); return; }
    onFarmConfirmed(result.farm);
  };
  const shownMessage = message ?? editor.error;

  return <section className="fixed inset-0 z-40 flex flex-col bg-meadow" aria-label="Mapa para marcar tu finca">
    <div className="relative h-[70svh] w-full overflow-hidden">
      <MapContainer center={[location.lat, location.lon]} zoom={8} scrollWheelZoom className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} attribution={satelliteAttribution} />
        <ZoomToLocation location={location} gpsAccuracyMeters={gpsAccuracyMeters} />
        <LassoDrawer onStart={() => setShowTutorial(false)} onComplete={onLasso} />
        {isPolygon && editor.vertices.length >= 3 && <Polygon positions={editor.vertices.map((point) => convertCoordinateOrder(point, "geojson"))} pathOptions={{ color: "#EAD39D", weight: 4, fillColor: "#EAD39D", fillOpacity: 0.25 }} />}
        <Marker position={[draft.lat, draft.lon]} icon={pinIcon} draggable={!isPolygon} eventHandlers={{ dragend: (event) => { const point = (event.target as L.Marker).getLatLng(); dispatch({ type: "set-location", location: validateMapLocation(point.lat, point.lng, draft.label), locationSource: "map" }); } }} title="Tu finca" />
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[600] rounded-full bg-meadow/85 px-3 py-1.5 backdrop-blur"><Logo variant="horizontal" className="h-7 w-auto" /></div>
      {showTutorial && <LassoTutorial />}
      {shownMessage && <p className="pointer-events-none absolute inset-x-4 top-16 z-[600] rounded-2xl bg-meadow/90 px-4 py-3 text-center text-base font-semibold text-cream" role="status">{shownMessage}</p>}
    </div>
    <div className="flex flex-1 items-center gap-3 px-4 pb-[env(safe-area-inset-bottom)]">
      <button type="button" onClick={onBack} aria-label="Volver al inicio" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><ArrowLeft /></button>
      <button type="button" onClick={reset} aria-label="Borrar y dibujar de nuevo" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><Restart /></button>
      <button type="button" onClick={confirm} disabled={!status.canConfirm} aria-label="Siguiente" className="flex h-20 min-w-0 flex-1 items-center justify-center rounded-full bg-cream text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50 disabled:opacity-40"><ArrowRight /></button>
    </div>
  </section>;
}
