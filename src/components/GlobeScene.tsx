"use client";

import Globe, { type GlobeMethods } from "react-globe.gl";
import { useEffect, useRef, useState } from "react";
import type { LocationResult } from "../types";

type GlobeSceneProps = { location: LocationResult | null };

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && canvas.getContext("webgl"));
  } catch { return false; }
}

export default function GlobeScene({ location }: GlobeSceneProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const resumeTimer = useRef<number | undefined>(undefined);
  const [webglAvailable] = useState(() => typeof window === "undefined" || supportsWebGL());
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [width, setWidth] = useState(() => typeof window === "undefined" ? 320 : Math.min(560, Math.max(280, window.innerWidth - 32)));

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMotion);
    const updateWidth = () => setWidth(Math.min(560, Math.max(280, window.innerWidth - 32)));
    window.addEventListener("resize", updateWidth);
    return () => { mediaQuery.removeEventListener("change", updateMotion); window.removeEventListener("resize", updateWidth); };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = !reducedMotion;
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
  }, [reducedMotion, webglAvailable]);

  useEffect(() => {
    if (location && globeRef.current) globeRef.current.pointOfView({ lat: location.lat, lng: location.lon, altitude: 1.5 }, 1800);
  }, [location]);

  if (!webglAvailable) return <div className="flex h-[320px] w-full max-w-[560px] items-center justify-center rounded-full border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-300" role="status">Tu navegador no puede mostrar el globo 3D. Puedes buscar una ubicación para continuar.</div>;

  return <Globe ref={globeRef} width={width} height={width} globeImageUrl="/textures/earth-bluemarble-2048.jpg" showAtmosphere atmosphereColor="#67e8f9" atmosphereAltitude={0.12} backgroundColor="rgba(0,0,0,0)" pointsData={location ? [location] : []} pointLat="lat" pointLng="lon" pointAltitude={0.08} pointRadius={0.6} pointColor={() => "#fbbf24"} pointLabel="label" rendererConfig={{ antialias: false, alpha: true, powerPreference: "high-performance" }} onGlobeReady={() => { globeRef.current?.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); }} aria-label="Globo terrestre interactivo" />;
}
