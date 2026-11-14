"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import LocationSearch from "../components/LocationSearch";
import type { LocationResult } from "../types";

const GlobeScene = dynamic(() => import("../components/GlobeScene"), { ssr: false, loading: () => <div className="flex h-[320px] w-full max-w-[560px] items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-sm text-slate-400" role="status">Cargando globo…</div> });
const MapScene = dynamic(() => import("../components/MapScene"), { ssr: false, loading: () => <div className="flex min-h-[420px] w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 text-sm text-slate-400" role="status">Cargando mapa…</div> });

export default function Home() {
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [showMap, setShowMap] = useState(false);
  const onContinue = (selectedLocation: LocationResult) => { setLocation(selectedLocation); setShowMap(true); };
  const onBackToGlobe = () => setShowMap(false);
  return <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#030712] px-4 py-6 text-slate-100 sm:py-8">
    <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_50%_20%,rgba(14,116,144,0.25),transparent_32%),radial-gradient(circle_at_10%_80%,rgba(30,64,175,0.16),transparent_28%)]" />
    <section className="relative z-10 flex w-full max-w-5xl flex-col items-center text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-cyan-300">NASA · agricultura · futuro</p>
      <h1 className="text-5xl font-semibold tracking-[0.18em] text-white sm:text-7xl">HEIMDALL</h1>
      <p className="mt-4 max-w-md text-base text-slate-300 sm:text-lg">Rotaciones de cultivo con datos de la NASA</p>
      <div className={`w-full transition-opacity duration-500 motion-reduce:transition-none ${showMap ? "pointer-events-none absolute opacity-0" : "opacity-100"}`} aria-hidden={showMap}>
        <div className="mt-4 flex h-[min(47vh,360px)] w-full max-w-[720px] justify-center sm:mt-2 sm:h-[min(65vh,680px)]"><GlobeScene location={location} active={!showMap} /></div>
        <div className="relative z-20 -mt-8 flex w-full justify-center sm:-mt-12"><LocationSearch onLocationSelected={setLocation} /></div>
        {location && <section className="mx-auto mt-6 w-full max-w-xl rounded-2xl border border-cyan-200/20 bg-slate-900/75 p-5 text-left shadow-2xl shadow-cyan-950/30" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Destino seleccionado</p>
          <h2 className="mt-2 text-lg font-semibold text-white">{location.label}</h2>
          <p className="mt-1 text-sm text-slate-400">Lat {location.lat.toFixed(4)} · Lon {location.lon.toFixed(4)}</p>
          <button type="button" onClick={() => onContinue(location)} className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200">Continuar</button>
        </section>}
      </div>
      {showMap && location && <div className="w-full text-left"><MapScene location={location} onLocationSelected={setLocation} onBack={onBackToGlobe} /></div>}
    </section>
    <footer className="relative z-10 mt-auto pt-10 text-xs text-slate-500">© Colaboradores de OpenStreetMap</footer>
  </main>;
}
