"use client";

import dynamic from "next/dynamic";
import { useEffect, useReducer, useState } from "react";
import LocationSearch from "../components/LocationSearch";
import { initialLocationFlow, locationFlowReducer } from "../lib/ui/locationFlow";
import type { LocationResult } from "../types";

const GlobeScene = dynamic(() => import("../components/GlobeScene"), { ssr: false, loading: () => <div className="flex h-[320px] w-full max-w-[560px] items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-sm text-slate-400" role="status">Cargando globo…</div> });
const MapScene = dynamic(() => import("../components/MapScene"), { ssr: false, loading: () => <div className="flex min-h-[420px] w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 text-sm text-slate-400" role="status">Cargando mapa…</div> });

export default function Home() {
  const [flow, dispatch] = useReducer(locationFlowReducer, initialLocationFlow);
  const [mapLocation, setMapLocation] = useState<LocationResult | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [webglAvailable] = useState(() => {
    if (typeof window === "undefined") return true;
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && canvas.getContext("webgl"));
  });
  const showMap = flow.status === "map" || flow.status === "confirmed";
  const location = flow.location;
  const gpsAccuracyMeters = "accuracyMeters" in flow ? flow.accuracyMeters : undefined;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    updateMotion();
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (flow.status !== "flying" && flow.status !== "transitioning") return;
    const instantaneo = reducedMotion || !webglAvailable;
    const delay = flow.status === "flying" ? (instantaneo ? 0 : 1800) : (instantaneo ? 0 : 500);
    const timer = window.setTimeout(() => dispatch({ type: "vueloTerminado", instantaneo }), delay);
    return () => window.clearTimeout(timer);
  }, [flow.status, reducedMotion, webglAvailable]);

  const onLocationSelected = (selectedLocation: LocationResult) => { setMapLocation(null); dispatch({ type: "buscar", location: selectedLocation }); };
  const onGpsLocationSelected = (selectedLocation: LocationResult, accuracyMeters: number) => { setMapLocation(null); dispatch({ type: "gpsOk", location: selectedLocation, accuracyMeters }); };
  const onBackToGlobe = () => { setMapLocation(null); dispatch({ type: "volver" }); };
  const globeFading = flow.status === "transitioning";
  return <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#030712] px-4 py-6 text-slate-100 sm:py-8">
    <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_50%_20%,rgba(14,116,144,0.25),transparent_32%),radial-gradient(circle_at_10%_80%,rgba(30,64,175,0.16),transparent_28%)]" />
    <section className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-cyan-300">NASA · agricultura · futuro</p>
      <h1 className={`font-semibold tracking-[0.18em] text-white ${showMap ? "text-3xl sm:text-5xl" : "text-5xl sm:text-7xl"}`}>HEIMDALL</h1>
      <p className={`max-w-md text-slate-300 ${showMap ? "mt-1 text-sm" : "mt-4 text-base sm:text-lg"}`}>Rotaciones de cultivo con datos de la NASA</p>
      <div className={`w-full transition-opacity duration-500 motion-reduce:transition-none ${showMap ? "pointer-events-none absolute opacity-0" : globeFading ? "opacity-0" : "opacity-100"}`} aria-hidden={showMap}>
        <div className="mt-4 flex h-[min(34vh,240px)] w-full max-w-[720px] justify-center sm:mt-2 sm:h-[min(65vh,680px)]"><GlobeScene location={location} active={!showMap && !globeFading} /></div>
        <div className="relative z-20 -mt-8 flex w-full justify-center sm:-mt-12"><LocationSearch onLocationSelected={onLocationSelected} onGpsStart={() => dispatch({ type: "locating" })} onGpsLocationSelected={onGpsLocationSelected} onGpsError={(message) => dispatch({ type: "gpsError", message })} /></div>
        {flow.status === "flying" && location && <p className="mx-auto mt-4 text-sm text-cyan-200" role="status" aria-live="polite">Volando hacia {location.label}…</p>}
      </div>
      {showMap && location && <div className="w-full text-left"><MapScene location={mapLocation ?? location} gpsAccuracyMeters={gpsAccuracyMeters} onLocationSelected={setMapLocation} onBack={onBackToGlobe} onConfirmed={() => dispatch({ type: "confirmar" })} /></div>}
    </section>
    {!showMap && <footer className="relative z-10 mt-auto pt-10 text-xs text-slate-500">© Colaboradores de OpenStreetMap</footer>}
  </main>;
}
