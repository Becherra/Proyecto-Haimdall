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
      // El zoom se calcula antes de mover el mapa: con fitBounds animado, getZoom() aún devolvía el 8 inicial y el mapa
      // siempre terminaba en 12, aunque la zona (p. ej. la vista del globo) pidiera más cerca.
      const bounds = L.latLngBounds(view.bounds);
      map.setView(bounds.getCenter(), Math.max(12, Math.min(view.targetZoom, map.getBoundsZoom(bounds))), { animate: !reducedMotion });
      return;
    }
    map.setView([location.lat, location.lon], 8, { animate: false });
    const timer = window.setTimeout(() => map.setZoom(view.targetZoom, { animate: !reducedMotion, duration: 1.8 }), 80);
    return () => window.clearTimeout(timer);
  }, [gpsAccuracyMeters, location, map]);
  return null;
}

/** Botones que mueven el mapa con el ratón: derecho, central, o izquierdo con Ctrl/⌘ (trackpads de Mac). */
const isPanButton = (event: MouseEvent | PointerEvent) => event.button === 2 || event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey));

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
    let panFrom: { x: number; y: number } | null = null;
    map.dragging.disable();
    container.style.touchAction = "none";

    const cancel = () => { stroke = []; drawingId = null; setTrail([]); };
    const toPixel = (event: PointerEvent): PixelPoint => { const point = map.mouseEventToContainerPoint(event); return [point.x, point.y]; };

    const onDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      if (pointers.size > 1) { cancel(); return; }
      const target = event.target as HTMLElement;
      if (event.pointerType === "mouse" && isPanButton(event)) return; // lo maneja onMouseDown
      if (event.button !== 0 || target.closest(".leaflet-marker-icon, .leaflet-control")) return;
      drawingId = event.pointerId;
      stroke = [toPixel(event)];
      callbacks.current.onStart();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== drawingId) return;
      const point = toPixel(event);
      const last = stroke[stroke.length - 1] as PixelPoint;
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_STEP_PX) return;
      stroke.push(point);
      setTrail(stroke.map(([x, y]) => { const latLng = map.containerPointToLatLng([x, y]); return [latLng.lat, latLng.lng]; }));
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (event.pointerId !== drawingId) return;
      const polygon = buildLassoPolygon(stroke);
      cancel();
      callbacks.current.onComplete(polygon ? polygon.map(([x, y]) => { const latLng = map.containerPointToLatLng([x, y]); return [latLng.lat, latLng.lng] as [number, number]; }) : null);
    };

    const onContextMenu = (event: Event) => event.preventDefault();
    // Computador: clic derecho (o central, o Ctrl/⌘ + clic) sostenido y mover el ratón arrastra el mapa.
    // Los eventos de ratón se escuchan en window para no perder el arrastre al salir del mapa.
    const onPanMove = (event: MouseEvent) => {
      if (!panFrom) return;
      map.panBy([panFrom.x - event.clientX, panFrom.y - event.clientY], { animate: false });
      panFrom = { x: event.clientX, y: event.clientY };
    };
    const endPan = () => { panFrom = null; container.style.cursor = ""; };
    const onMouseDown = (event: MouseEvent) => {
      if (!isPanButton(event) || (event.target as HTMLElement).closest(".leaflet-control")) return;
      event.preventDefault();
      panFrom = { x: event.clientX, y: event.clientY };
      container.style.cursor = "grabbing";
    };
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onPanMove);
    window.addEventListener("mouseup", endPan);
    window.addEventListener("blur", endPan);
    container.addEventListener("contextmenu", onContextMenu);
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    return () => {
      container.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onPanMove);
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("blur", endPan);
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      map.dragging.enable();
    };
  }, [map]);

  return trail.length > 1 ? <Polyline positions={trail} pathOptions={{ color: "#EAD39D", weight: 5, opacity: 0.95 }} /> : null;
}

/** Un dedo con la yema en (0,0) apuntando hacia arriba: cilindro suave que se desvanece hacia abajo, con uña. */
function Finger({ x = 0, tipY = 0 }: { x?: number; tipY?: number }) {
  const length = 30;
  return <g transform={`translate(${x} ${tipY})`}>
    <path d={`M -4 5 C -4 -1.2 -2.3 -3 0 -3 C 2.3 -3 4 -1.2 4 5 L 4.4 ${length} L -4.4 ${length} Z`} fill="url(#finger-fade)" />
    <path d="M -2.3 4 C -2.3 0.6 -1.4 -0.8 0 -0.8 C 1.4 -0.8 2.3 0.6 2.3 4 C 1 5.2 -1 5.2 -2.3 4 Z" fill="#FFFFFF" opacity="0.55" />
  </g>;
}

/** Solo los dedos (sin palma): 1 dedo para dibujar el lazo, 2 dedos para mover el mapa. */
function Hand({ fingers }: { fingers: 1 | 2 }) {
  return <g>
    <defs>
      <linearGradient id="finger-fade" gradientUnits="userSpaceOnUse" x1="0" y1="-3" x2="0" y2="30">
        <stop offset="0" stopColor="#F8EFD2" />
        <stop offset="0.55" stopColor="#EAD39D" stopOpacity="0.9" />
        <stop offset="1" stopColor="#EAD39D" stopOpacity="0" />
      </linearGradient>
    </defs>
    {fingers === 1 ? <Finger /> : (
      // Dos dedos independientes (separados también en la base), ligeramente abiertos, apuntando en la dirección del arrastre.
      <g transform="rotate(45)">
        <g transform="rotate(-12 -10 30)"><Finger x={-10} /></g>
        <g transform="rotate(12 10 30)"><Finger x={10} /></g>
      </g>
    )}
  </g>;
}

/** Tutorial solo visual, en dos pasos: 1) un dedo rodea el terreno; 2) dos dedos mueven el mapa. */
function LassoTutorial() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setStep(1), TUTORIAL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const loop = "M 28 50 C 22 28, 52 16, 72 27 C 90 38, 80 66, 56 70 C 38 73, 30 62, 28 50 Z";
  const drag = "M 34 56 L 70 24";
  return <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-meadow/45" aria-hidden="true">
    <svg viewBox="0 0 100 100" className="h-3/4 max-h-96 w-3/4 max-w-96 overflow-visible">
      {step === 0 ? <g key="lasso">
        <path d={loop} fill="none" stroke="rgb(234 211 157 / 0.3)" strokeWidth="2" strokeDasharray="1 3" strokeLinecap="round" />
        <path className="lasso-tutorial-stroke" d={loop} fill="rgb(234 211 157 / 0.2)" stroke="#EAD39D" strokeWidth="3.5" strokeLinecap="round" pathLength="1" />
        <g className="lasso-tutorial-finger">
          <circle r="7" fill="#EAD39D" opacity="0.35" />
          <Hand fingers={1} />
          <animateMotion dur="2.6s" repeatCount="indefinite" path={loop} />
        </g>
      </g> : <g key="pan">
        <path d={drag} fill="none" stroke="rgb(234 211 157 / 0.6)" strokeWidth="3" strokeDasharray="1 5" strokeLinecap="round" />
        <path d="M 62 22 L 72 22 L 72 32" fill="none" stroke="#EAD39D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <g className="lasso-tutorial-finger">
          <g transform="rotate(45)"><circle r="7" cx="-16.2" cy="0.7" fill="#EAD39D" opacity="0.35" /><circle r="7" cx="16.2" cy="0.7" fill="#EAD39D" opacity="0.35" /></g>
          <Hand fingers={2} />
          <animateMotion dur="2s" repeatCount="indefinite" path={drag} calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.7;1" />
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
  const [tutorialRun, setTutorialRun] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const status = getTerrainEditorStatus(editor);
  const draft = editor.location;
  const isPolygon = editor.mode === "polygon";

  useEffect(() => {
    const timer = window.setTimeout(() => setShowTutorial(false), TUTORIAL_MS);
    return () => window.clearTimeout(timer);
  }, [tutorialRun]);

  const onLasso = (points: [number, number][] | null) => {
    if (!points) { setMessage("Rodea todo tu terreno con el dedo"); return; }
    setMessage(null);
    dispatch({ type: "set-polygon", points });
  };
  const reset = () => { dispatch({ type: "reset", initial: initialEditor }); setMessage(null); setShowTutorial(true); setTutorialRun((run) => run + 1); };
  const confirm = () => {
    const candidate = buildFarmFromEditor(editor);
    const result = candidate ? validateFarmDraft(candidate) : null;
    if (!result?.valid) { setMessage(result?.errors.join(" ") ?? status.error ?? "Rodea tu terreno otra vez"); return; }
    onFarmConfirmed(result.farm);
  };
  const shownMessage = message ?? editor.error;

  return <section className="fixed inset-0 z-40 flex flex-col bg-scene" aria-label="Mapa para marcar tu finca">
    <div className="relative h-[70svh] w-full overflow-hidden lg:h-auto lg:flex-1">
      <MapContainer center={[location.lat, location.lon]} zoom={8} scrollWheelZoom className="h-full w-full" zoomControl={false}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} attribution={satelliteAttribution} />
        <ZoomToLocation location={location} gpsAccuracyMeters={gpsAccuracyMeters} />
        <LassoDrawer onStart={() => setShowTutorial(false)} onComplete={onLasso} />
        {isPolygon && editor.vertices.length >= 3 && <Polygon positions={editor.vertices.map((point) => convertCoordinateOrder(point, "geojson"))} pathOptions={{ color: "#EAD39D", weight: 4, fillColor: "#EAD39D", fillOpacity: 0.25 }} />}
        <Marker position={[draft.lat, draft.lon]} icon={pinIcon} draggable={!isPolygon} eventHandlers={{ dragend: (event) => { const point = (event.target as L.Marker).getLatLng(); dispatch({ type: "set-location", location: validateMapLocation(point.lat, point.lng, draft.label), locationSource: "map" }); } }} title="Tu finca" />
      </MapContainer>
      <div className="pointer-events-none absolute left-1/2 top-3 z-[600] -translate-x-1/2 rounded-full bg-meadow/85 px-4 py-1.5 backdrop-blur"><Logo variant="horizontal" size={36} /></div>
      {showTutorial && <LassoTutorial key={tutorialRun} />}
      {shownMessage && <p className="pointer-events-none absolute inset-x-4 top-16 z-[600] rounded-2xl lg:inset-x-auto lg:left-1/2 lg:w-max lg:max-w-xl lg:-translate-x-1/2 bg-meadow/90 px-4 py-3 text-center text-base font-semibold text-cream" role="status">{shownMessage}</p>}
    </div>
    <div className="flex flex-1 items-center gap-3 px-4 pb-[env(safe-area-inset-bottom)] lg:mx-auto lg:w-full lg:max-w-2xl lg:flex-none lg:py-4">
      <button type="button" onClick={onBack} aria-label="Volver al inicio" className="flex h-20 w-20 shrink-0 lg:h-16 lg:w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><ArrowLeft /></button>
      <button type="button" onClick={reset} aria-label="Borrar y dibujar de nuevo" className="flex h-20 w-20 shrink-0 lg:h-16 lg:w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><Restart /></button>
      <button type="button" onClick={confirm} disabled={!status.canConfirm} aria-label="Siguiente" className="flex h-20 min-w-0 flex-1 lg:h-16 items-center justify-center rounded-full bg-cream text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50 disabled:opacity-40"><ArrowRight /></button>
    </div>
  </section>;
}
