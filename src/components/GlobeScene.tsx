"use client";

import Globe, { type GlobeMethods } from "react-globe.gl";
import { useEffect, useRef, useState } from "react";
import { calculateGlobeView } from "../lib/ui/globeView";
import type { LocationResult } from "../types";

type GlobeSceneProps = { location: LocationResult | null; active?: boolean; introSpin?: boolean };
// globe.gl clears material.color when it applies a texture, so a uniform material tint cannot color land and sea separately.
const TWO_K_TEXTURE = "/textures/earth-bluemarble-2048-heimdall.webp";
// NASA SVS Blue Marble January source: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/january/world.topo.200401.3x5400x2700.jpg
// Imagen: NASA Blue Marble, con tratamiento de color propio.
const FOUR_K_TEXTURE = "/textures/earth-bluemarble-4k-heimdall.webp";

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && canvas.getContext("webgl"));
  } catch { return false; }
}

function canUseHighResolutionTexture(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  const slowNetwork = connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
  return !window.matchMedia("(max-width: 767px)").matches && !slowNetwork;
}

export default function GlobeScene({ location, active = true, introSpin = false }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const resumeTimer = useRef<number | undefined>(undefined);
  const [webglAvailable] = useState(() => typeof window === "undefined" || supportsWebGL());
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [markerPulse, setMarkerPulse] = useState(false);
  const globeImageUrl = location && canUseHighResolutionTexture() ? FOUR_K_TEXTURE : TWO_K_TEXTURE;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

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

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.enabled = active;
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
  }, [active, reducedMotion, webglAvailable]);

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

  const fallback = <div className="flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-black p-8 text-center text-sm text-slate-300" role="status">Tu navegador no puede mostrar el globo 3D. Puedes buscar una ubicación para continuar.</div>;

  return <div ref={containerRef} className="flex h-full w-full items-center justify-center" aria-label="Globo terrestre interactivo">{!webglAvailable ? fallback : size.width > 0 && size.height > 0 ? <Globe ref={globeRef} width={size.width} height={size.height} globeImageUrl={globeImageUrl} showAtmosphere atmosphereColor="#8052ff" atmosphereAltitude={0.12} backgroundColor="rgba(0,0,0,0)" pointsData={location ? [location] : []} pointLat="lat" pointLng="lon" pointAltitude={0.08} pointRadius={reducedMotion ? 0.6 : markerPulse ? 0.75 : 0.6} pointColor={() => "#ffb829"} pointLabel="label" rendererConfig={{ antialias: false, alpha: true, powerPreference: "high-performance" }} onGlobeReady={() => { globeRef.current?.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); }} /> : <div className="text-sm text-slate-500" role="status">Preparando globo…</div>}</div>;
}
