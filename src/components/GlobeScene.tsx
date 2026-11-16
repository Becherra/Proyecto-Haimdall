"use client";

import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import ThreeSlippyMapGlobe from "three-slippy-map-globe";
import { useEffect, useMemo, useRef, useState } from "react";
import { GLOBE_RELIEF } from "../lib/config";
import { calculateGlobeView, globeCurvatureResolution, referenceLayerScale } from "../lib/ui/globeView";
import type { LocationResult } from "../types";

type GlobeSceneProps = { location: LocationResult | null; active?: boolean; introSpin?: boolean };
// globe.gl clears material.color when it applies a texture, so a uniform material tint cannot color land and sea separately.
const TWO_K_TEXTURE = "/textures/earth-bluemarble-2048-heimdall.webp";
// NASA SVS Blue Marble January source: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/january/world.topo.200401.3x5400x2700.jpg
// Imagen: NASA Blue Marble, con tratamiento de color propio.
const FOUR_K_TEXTURE = "/textures/earth-bluemarble-4k-heimdall.webp";
// Elevación NASA Blue Marble Next Generation (GEBCO_08); fuente y créditos en public/textures/README.md.
const ELEVATION_TEXTURE = "/textures/earth-elevation-2048.webp";
/** Intensidad del sombreado del relieve; probado a ojo para que las cordilleras se lean sin manchar el mar. */
const BUMP_SCALE = 6;
const RELIEF_LIGHT = { ambient: 0.55 * Math.PI, directional: 1.1 * Math.PI } as const;
/**
 * Capa transparente de Esri con fronteras, nombres de países, departamentos y ciudades que se dibuja sobre el relieve para
 * que el agricultor se ubique. Los nombres vienen tal como los publica Esri (no están traducidos). Solo se usa a la altura
 * del globo entero o de la vista de una ubicación: más cerca los nombres se recortan, por eso el zoom manual está apagado.
 */
const referenceTileUrl = (x: number, y: number, level: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${level}/${y}/${x}`;
const REFERENCE_MAX_LEVEL = 8;

/**
 * globe.gl ilumina con una luz ambiental fuerte y otra fija sobre el polo norte, así el relieve casi no da sombra.
 * Bajamos la ambiental y colgamos la direccional de la cámara (arriba a la izquierda): las laderas siempre se ven
 * con luz rasante, gire como gire el globo.
 */
function setGlobeLighting(globe: GlobeMethods): void {
  const camera = globe.camera();
  const light = RELIEF_LIGHT;
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

/** Motor de mosaicos que three-globe lleva dentro (apagado): cuelga del grupo del globo, que es donde se monta la capa de nombres. */
function findTileEngine(globe: GlobeMethods): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  globe.scene().traverse((object) => { if (!found && "updatePov" in object && "minLevel" in object) found = object; });
  return found;
}

/**
 * Crea la capa de nombres y límites con el mismo motor de mosaicos de three-globe. Los mosaicos llegan con
 * transparencia: se marcan transparentes al añadirse (antes de su primer dibujo) para no verse como cuadros negros.
 */
function createReferenceLayer(globe: GlobeMethods, curvatureResolution: number, onTileAdded: () => void): ThreeSlippyMapGlobe | null {
  const engine = findTileEngine(globe);
  if (!engine?.parent) return null;
  const layer = new ThreeSlippyMapGlobe(globe.getGlobeRadius(), { tileUrl: referenceTileUrl, maxLevel: REFERENCE_MAX_LEVEL });
  // Misma malla que el globo: con una más gruesa (5° por defecto) la capa se hunde bajo el relieve y los nombres salen cortados.
  layer.curvatureResolution = curvatureResolution;
  // La esfera negra de respaldo que trae el motor taparía el planeta mientras llegan los mosaicos.
  layer.children.filter((child) => child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial).forEach((child) => layer.remove(child));
  const addToGroup = layer.add.bind(layer);
  layer.add = (...objects: THREE.Object3D[]) => {
    for (const object of objects) {
      object.userData.level = layer.level;
      if (object instanceof THREE.Mesh && object.material instanceof THREE.Material) { object.material.transparent = true; object.material.depthWrite = false; object.renderOrder = 2; }
    }
    onTileAdded();
    return addToGroup(...objects);
  };
  engine.parent.add(layer);
  return layer;
}

/**
 * El motor deja debajo los mosaicos del nivel anterior mientras llegan los nuevos; con imagen opaca no se nota, pero con
 * una capa transparente los nombres salen dobles (uno grande y otro chico). Cuando ya hay mosaicos del nivel actual se
 * ocultan los de niveles más gruesos.
 */
function hideSupersededLevels(layer: ThreeSlippyMapGlobe): void {
  const levelOf = (object: THREE.Object3D) => (typeof object.userData.level === "number" ? object.userData.level : layer.level);
  const hasCurrent = layer.children.some((child) => levelOf(child) === layer.level);
  layer.children.forEach((child) => { child.visible = !hasCurrent || levelOf(child) >= layer.level; });
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

export default function GlobeScene({ location, active = true, introSpin = false }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const resumeTimer = useRef<number | undefined>(undefined);
  const referenceLayer = useRef<ThreeSlippyMapGlobe | null>(null);
  const referenceTimer = useRef<number | undefined>(undefined);
  const [webglAvailable] = useState(() => typeof window === "undefined" || supportsWebGL());
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [curvatureResolution] = useState(() => globeCurvatureResolution(isSmallScreen()));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [markerPulse, setMarkerPulse] = useState(false);
  const globeImageUrl = location && canUseHighResolutionTexture() ? FOUR_K_TEXTURE : TWO_K_TEXTURE;
  const reliefMaterial = useMemo(() => new THREE.MeshPhongMaterial({ shininess: 4, bumpScale: BUMP_SCALE }), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    // Levanta la malla (silueta de las montañas); el sombreado de las laderas lo pone `bumpImageUrl` con el mismo mapa.
    const texture = new THREE.TextureLoader().load(ELEVATION_TEXTURE, () => {
      reliefMaterial.displacementMap = texture;
      reliefMaterial.displacementScale = 100 * GLOBE_RELIEF.maxHeightRatio;
      reliefMaterial.needsUpdate = true;
    });
    return () => texture.dispose();
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

  useEffect(() => () => { window.clearTimeout(referenceTimer.current); const layer = referenceLayer.current; layer?.clearTiles(); layer?.removeFromParent(); referenceLayer.current = null; }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.enabled = active;
    // Solo se gira: acercar a mano deja los nombres recortados, así que el acercamiento ocurre únicamente al elegir una ubicación.
    controls.enableZoom = false;
    controls.autoRotate = active && !reducedMotion;
    if (reducedMotion) return;
    const pause = () => {
      controls.autoRotate = false;
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
    const resume = () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => { controls.autoRotate = true; }, 3500);
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

  /** Espera un momento a que lleguen los mosaicos nuevos antes de ocultar los viejos, para no dejar huecos. */
  function scheduleReferenceCleanup() {
    window.clearTimeout(referenceTimer.current);
    referenceTimer.current = window.setTimeout(() => { if (referenceLayer.current) hideSupersededLevels(referenceLayer.current); }, 450);
  }

  /** Cada movimiento de la cámara pide a la capa de nombres los mosaicos que toca. */
  function updateReferenceLayer() {
    const globe = globeRef.current;
    const reference = referenceLayer.current;
    if (!globe || !reference) return;
    reference.updatePov(globe.camera());
    scheduleReferenceCleanup();
  }

  const fallback = <div className="flex h-full w-full items-center justify-center rounded-full border border-cream/10 bg-meadow p-8 text-center text-sm text-silver-mist" role="status">Tu navegador no puede mostrar el globo 3D. Puedes buscar una ubicación para continuar.</div>;
  const showHint = active && webglAvailable && !location;

  return <div ref={containerRef} className="relative flex h-full w-full items-center justify-center" aria-label="Globo terrestre con relieve, fronteras y nombres: gíralo para explorar">
    {!webglAvailable ? fallback : size.width > 0 && size.height > 0 ? <Globe ref={globeRef} width={size.width} height={size.height} globeImageUrl={globeImageUrl} globeMaterial={reliefMaterial} bumpImageUrl={ELEVATION_TEXTURE} globeCurvatureResolution={curvatureResolution} showAtmosphere atmosphereColor="#737F35" atmosphereAltitude={0.12} backgroundColor="rgba(0,0,0,0)" pointsData={location ? [location] : []} pointLat="lat" pointLng="lon" pointAltitude={0.08} pointRadius={reducedMotion ? 0.6 : markerPulse ? 0.75 : 0.6} pointColor={() => "#EAD39D"} pointLabel="label" onZoom={updateReferenceLayer} rendererConfig={{ antialias: false, alpha: true, powerPreference: "high-performance" }} onGlobeReady={() => { const globe = globeRef.current; if (!globe) return; globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); setGlobeLighting(globe); referenceLayer.current ??= createReferenceLayer(globe, curvatureResolution, scheduleReferenceCleanup); referenceLayer.current?.scale.setScalar(referenceLayerScale()); updateReferenceLayer(); }} /> : <div className="text-sm text-ash-gray" role="status">Preparando globo…</div>}
    {showHint && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full border border-cream/20 bg-meadow/85 px-4 py-2 text-center text-xs text-silver-mist sm:text-sm" role="status">Gira el globo para explorar el mundo</p>}
  </div>;
}
