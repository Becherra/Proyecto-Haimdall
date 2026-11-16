"use client";

import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { GLOBE_RELIEF } from "../lib/config";
import { calculateGlobeView, cameraNearPlane, canMarkFarmAt, GLOBE_ZOOM_LIMITS, globeCurvatureResolution, globeRotateSpeed, globeZoomSpeed, nextGlobeSurface, tapZoomAltitude, visibleHalfSpanDegrees, type GlobeSurface } from "../lib/ui/globeView";
import { buildGlobePickLocation, pickReliefPoint, sampleElevation, type ElevationGrid, type GeoPoint } from "../lib/ui/globePick";
import type { LocationResult } from "../types";

type GlobeSceneProps = {
  location: LocationResult | null;
  active?: boolean;
  introSpin?: boolean;
  /** El agricultor ya se acercó hasta su finca y pide marcarla: recibe el centro y lo que se ve en pantalla. */
  onMarkFarm?: (location: LocationResult) => void;
  /** true mientras el globo muestra imagen satelital y debe ocupar toda la pantalla. */
  onExpandedChange?: (expanded: boolean) => void;
};
// globe.gl clears material.color when it applies a texture, so a uniform material tint cannot color land and sea separately.
const TWO_K_TEXTURE = "/textures/earth-bluemarble-2048-heimdall.webp";
// NASA SVS Blue Marble January source: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/january/world.topo.200401.3x5400x2700.jpg
// Imagen: NASA Blue Marble, con tratamiento de color propio.
const FOUR_K_TEXTURE = "/textures/earth-bluemarble-4k-heimdall.webp";
// Elevación NASA Blue Marble Next Generation (GEBCO_08); fuente y créditos en public/textures/README.md.
const ELEVATION_TEXTURE = "/textures/earth-elevation-2048.webp";
/** La copia en CPU solo sirve para ubicar el toque; a esta resolución (~40 km por pixel) basta y pesa 2 MB. */
const ELEVATION_SAMPLE_WIDTH = 1024;
/** Intensidad del sombreado del relieve; probado a ojo para que las cordilleras se lean sin manchar el mar. */
const BUMP_SCALE = 6;
/** Por debajo de esta altitud de cámara la textura de 2K ya se ve borrosa. */
const HIGH_RESOLUTION_ALTITUDE = 1.2;
const RELIEF_LIGHT = { ambient: 0.55 * Math.PI, directional: 1.1 * Math.PI } as const;
/** La foto satelital ya trae sus sombras: se ilumina pareja para no oscurecerla. */
const SATELLITE_LIGHT = { ambient: Math.PI, directional: 0 } as const;
/**
 * Mosaicos satelitales Esri World Imagery, los mismos del mapa de marcado (MapScene). `blankTile=false` hace que donde no
 * hay foto (mar abierto, zonas sin detalle) el servidor responda 404 en vez de un letrero gris; así se sigue viendo el
 * mosaico anterior, más borroso pero real.
 */
const satelliteTileUrl = (x: number, y: number, level: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${level}/${y}/${x}?blankTile=false`;
// globe.gl acepta `globeTileEngineMaxLevel` (por defecto 17) pero los tipos de react-globe.gl no lo declaran; sin subir a 18
// no se llega a ver una casa.
const satelliteLevelProps = { globeTileEngineMaxLevel: 18 } as object;
const TAP_FLIGHT_MS = 900;
const TILE_LOADING_COLOR = "#1d3a40";

type Elevation = { texture: THREE.Texture; grid: ElevationGrid };

/**
 * globe.gl ilumina con una luz ambiental fuerte y otra fija sobre el polo norte, así el relieve casi no da sombra.
 * Bajamos la ambiental y colgamos la direccional de la cámara (arriba a la izquierda): las laderas siempre se ven
 * con luz rasante, gire como gire el globo.
 */
function setGlobeLighting(globe: GlobeMethods, surface: GlobeSurface): void {
  const camera = globe.camera();
  const light = surface === "relief" ? RELIEF_LIGHT : SATELLITE_LIGHT;
  for (const item of globe.lights()) {
    if (item instanceof THREE.AmbientLight) item.intensity = light.ambient;
    if (item instanceof THREE.DirectionalLight) {
      item.intensity = light.directional;
      item.position.set(-1.2, 1, 0.6);
      if (item.parent !== camera) camera.add(item);
    }
  }
  if (!camera.parent) globe.scene().add(camera);
}

/**
 * Bajo los mosaicos satelitales three-slippy-map-globe pone una esfera negra; mientras llegan las imágenes se veía un
 * pantallazo negro. Se pinta del tono del océano de la portada para que la espera no parezca un error.
 */
function tintTileBackLayer(globe: GlobeMethods): void {
  const radius = globe.getGlobeRadius();
  globe.scene().traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial && object.geometry instanceof THREE.SphereGeometry && object.geometry.parameters.radius < radius) object.material.color.set(TILE_LOADING_COLOR);
  });
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && canvas.getContext("webgl"));
  } catch { return false; }
}

function isSmallScreen(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function canUseHighResolutionTexture(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  const slowNetwork = connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
  return !isSmallScreen() && !slowNetwork;
}

/** Una sola descarga sirve para la textura de la GPU y para la copia que lee el toque. */
function loadElevation(): Promise<Elevation | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = ELEVATION_SAMPLE_WIDTH;
        canvas.height = ELEVATION_SAMPLE_WIDTH / 2;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        resolve({ texture, grid: { values: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height, stride: 4 } });
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = ELEVATION_TEXTURE;
  });
}

export default function GlobeScene({ location, active = true, introSpin = false, onMarkFarm, onExpandedChange }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const resumeTimer = useRef<number | undefined>(undefined);
  const elevationGrid = useRef<ElevationGrid | null>(null);
  const surfaceRef = useRef<GlobeSurface>("relief");
  const [webglAvailable] = useState(() => typeof window === "undefined" || supportsWebGL());
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [curvatureResolution] = useState(() => globeCurvatureResolution(isSmallScreen()));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [markerPulse, setMarkerPulse] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [surface, setSurface] = useState<GlobeSurface>("relief");
  const [canMark, setCanMark] = useState(false);
  // La textura de 4K solo se pide cuando hace falta: al acercarse o al volar a una ubicación.
  const globeImageUrl = (location || zoomedIn) && canUseHighResolutionTexture() ? FOUR_K_TEXTURE : TWO_K_TEXTURE;
  const reliefMaterial = useMemo(() => new THREE.MeshPhongMaterial({ shininess: 4, bumpScale: BUMP_SCALE }), []);
  const satellite = surface === "satellite";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let texture: THREE.Texture | undefined;
    void loadElevation().then((elevation) => {
      if (cancelled || !elevation) { elevation?.texture.dispose(); return; }
      texture = elevation.texture;
      elevationGrid.current = elevation.grid;
      // Levanta la malla (silueta de las montañas); el sombreado de las laderas lo pone `bumpImageUrl` con el mismo mapa.
      reliefMaterial.displacementMap = texture;
      reliefMaterial.displacementScale = 100 * GLOBE_RELIEF.maxHeightRatio;
      reliefMaterial.needsUpdate = true;
    });
    return () => { cancelled = true; texture?.dispose(); };
  }, [reliefMaterial]);

  useEffect(() => () => reliefMaterial.dispose(), [reliefMaterial]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { onExpandedChange?.(satellite); }, [onExpandedChange, satellite]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    setGlobeLighting(globe, surface);
    if (surface === "satellite") globe.controls().autoRotate = false;
  }, [surface, size.width]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    const radius = globe.getGlobeRadius();
    controls.enabled = active;
    controls.autoRotate = active && !reducedMotion && surfaceRef.current === "relief";
    controls.minDistance = radius * (1 + GLOBE_ZOOM_LIMITS.minAltitude);
    controls.maxDistance = radius * (1 + GLOBE_ZOOM_LIMITS.maxAltitude);
    if (reducedMotion) return;
    const pause = () => {
      controls.autoRotate = false;
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
    const resume = () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      // Girar solo tiene sentido viendo el planeta; sobre el terreno movería la vista kilómetros por segundo.
      resumeTimer.current = window.setTimeout(() => { controls.autoRotate = surfaceRef.current === "relief"; }, 3500);
    };
    controls.autoRotateSpeed = 0.28;
    controls.enableDamping = true;
    controls.addEventListener("start", pause);
    controls.addEventListener("end", resume);
    return () => { controls.removeEventListener("start", pause); controls.removeEventListener("end", resume); if (resumeTimer.current) window.clearTimeout(resumeTimer.current); };
  }, [active, reducedMotion, webglAvailable, size.width]);

  useEffect(() => {
    if (location && globeRef.current && size.width > 0) {
      const view = calculateGlobeView(true, size.width, reducedMotion);
      globeRef.current.pointOfView({ lat: location.lat, lng: location.lon, altitude: view.altitude }, view.transitionMs);
    }
  }, [location, reducedMotion, size.width]);

  useEffect(() => {
    if (!introSpin || !globeRef.current) return;
    const start = performance.now();
    let frame = 0;
    const spin = (now: number) => {
      const progress = Math.min(1, (now - start) / 1000);
      globeRef.current?.pointOfView({ lat: 0, lng: progress * 360, altitude: 2.5 });
      if (progress < 1) frame = window.requestAnimationFrame(spin);
    };
    frame = window.requestAnimationFrame(spin);
    return () => window.cancelAnimationFrame(frame);
  }, [introSpin]);

  useEffect(() => {
    if (!location || reducedMotion) return;
    const interval = window.setInterval(() => setMarkerPulse((active) => !active), 1400);
    return () => window.clearInterval(interval);
  }, [location, reducedMotion]);

  /** Ajusta cámara, controles y modo a una altitud; solo toca el estado de React cuando algo visible cambia. */
  function syncToAltitude(altitude: number) {
    const globe = globeRef.current;
    if (!globe) return;
    const camera = globe.camera() as THREE.PerspectiveCamera;
    const near = cameraNearPlane(altitude, globe.getGlobeRadius());
    if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
    globe.controls().zoomSpeed = globeZoomSpeed(altitude);
    globe.controls().rotateSpeed = globeRotateSpeed(altitude);
    const nextSurface = nextGlobeSurface(surfaceRef.current, altitude);
    surfaceRef.current = nextSurface;
    setSurface(nextSurface);
    setCanMark(canMarkFarmAt(altitude));
    if (altitude < HIGH_RESOLUTION_ALTITUDE) setZoomedIn(true);
  }

  function flyTo(point: GeoPoint, altitude: number) {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = false;
    // El plano cercano se ajusta antes del vuelo para que el suelo no se recorte al bajar.
    syncToAltitude(Math.min(altitude, globe.pointOfView().altitude));
    globe.pointOfView({ lat: point.lat, lng: point.lon, altitude }, reducedMotion ? 0 : TAP_FLIGHT_MS);
    window.setTimeout(() => syncToAltitude(altitude), reducedMotion ? 0 : TAP_FLIGHT_MS + 50);
  }

  /** Tocar acerca hacia ese punto. Con relieve, globe.gl cortaría contra la esfera lisa; se corrige sobre las montañas. */
  function onGlobeClick(coords: { lat: number; lng: number }, event: MouseEvent) {
    const globe = globeRef.current;
    if (!active || !globe) return;
    const flat: GeoPoint = { lat: coords.lat, lon: coords.lng };
    const grid = elevationGrid.current;
    let target = flat;
    if (surfaceRef.current === "relief" && grid) {
      const rect = globe.renderer().domElement.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), globe.camera());
      const radius = globe.getGlobeRadius();
      target = pickReliefPoint({ origin: raycaster.ray.origin, direction: raycaster.ray.direction }, { radius, maxHeight: radius * GLOBE_RELIEF.maxHeightRatio, heightAt: (point) => sampleElevation(grid, point) }) ?? flat;
    }
    flyTo(target, tapZoomAltitude(globe.pointOfView().altitude));
  }

  function backToPlanet() {
    const globe = globeRef.current;
    if (!globe) return;
    const { lat, lng } = globe.pointOfView();
    globe.pointOfView({ lat, lng, altitude: 1.5 }, reducedMotion ? 0 : 1200);
    window.setTimeout(() => syncToAltitude(1.5), reducedMotion ? 0 : 1250);
  }

  function markFarm() {
    const globe = globeRef.current;
    if (!globe || !onMarkFarm) return;
    const { lat, lng, altitude } = globe.pointOfView();
    onMarkFarm(buildGlobePickLocation({ lat, lon: lng }, visibleHalfSpanDegrees(altitude)));
  }

  const fallback = <div className="flex h-full w-full items-center justify-center rounded-full border border-cream/10 bg-meadow p-8 text-center text-sm text-silver-mist" role="status">Tu navegador no puede mostrar el globo 3D. Puedes buscar una ubicación para continuar.</div>;
  const showControls = active && webglAvailable && !location;

  return <div ref={containerRef} className="relative flex h-full w-full items-center justify-center" aria-label="Globo terrestre con relieve que también es mapa: gíralo y acércalo hasta tu finca">
    {!webglAvailable ? fallback : size.width > 0 && size.height > 0 ? <Globe ref={globeRef} width={size.width} height={size.height} globeImageUrl={globeImageUrl} globeMaterial={reliefMaterial} bumpImageUrl={ELEVATION_TEXTURE} globeTileEngineUrl={satellite ? satelliteTileUrl : null} {...satelliteLevelProps} globeCurvatureResolution={curvatureResolution} showAtmosphere atmosphereColor="#737F35" atmosphereAltitude={0.12} backgroundColor="rgba(0,0,0,0)" pointsData={location ? [location] : []} pointLat="lat" pointLng="lon" pointAltitude={0.08} pointRadius={reducedMotion ? 0.6 : markerPulse ? 0.75 : 0.6} pointColor={() => "#EAD39D"} pointLabel="label" onGlobeClick={onGlobeClick} onZoom={({ altitude }) => syncToAltitude(altitude)} showPointerCursor={(objType) => active && objType === "globe"} rendererConfig={{ antialias: false, alpha: true, powerPreference: "high-performance" }} onGlobeReady={() => { const globe = globeRef.current; if (!globe) return; globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); setGlobeLighting(globe, surfaceRef.current); tintTileBackLayer(globe); }} /> : <div className="text-sm text-ash-gray" role="status">Preparando globo…</div>}
    {showControls && satellite && <button type="button" onClick={backToPlanet} className="absolute left-4 top-4 z-10 flex min-h-14 items-center gap-2 rounded-full border-2 border-cream/50 bg-meadow/85 px-5 text-base font-medium text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><span aria-hidden="true">←</span> Ver el planeta</button>}
    {showControls && <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-4">
      {satellite && canMark && onMarkFarm
        ? <button type="button" onClick={markFarm} className="pointer-events-auto min-h-16 w-full max-w-md rounded-full bg-cream px-6 py-4 text-lg font-bold text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-2 focus:ring-cream focus:ring-offset-2 focus:ring-offset-meadow">Marcar mi finca aquí</button>
        : <p className="w-fit max-w-full rounded-full border border-cream/20 bg-meadow/85 px-4 py-2 text-center text-xs text-silver-mist sm:text-sm" role="status">{satellite ? "Sigue acercándote hasta ver tu finca" : "Gira el globo y acércate a tu finca (toca para acercar)"}</p>}
      {satellite && <p className="text-[10px] text-silver-mist/80">Imagen satelital © Esri</p>}
    </div>}
  </div>;
}
