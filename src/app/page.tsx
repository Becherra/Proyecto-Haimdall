"use client";

import dynamic from "next/dynamic";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import LocationSearch from "../components/LocationSearch";
import { initialLocationFlow, locationFlowReducer } from "../lib/ui/locationFlow";
import { getHeroIntroStage, HERO_INTRO_DURATION_MS, type HeroIntroStage } from "../lib/ui/heroTimeline";
import type { LocationResult } from "../types";

const GlobeScene = dynamic(() => import("../components/GlobeScene"), { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center rounded-full bg-white/[0.03] text-sm text-ash-gray" role="status">Cargando globo…</div> });
const MapScene = dynamic(() => import("../components/MapScene"), { ssr: false, loading: () => <div className="flex min-h-[360px] w-full items-center justify-center text-sm text-ash-gray" role="status">Cargando mapa…</div> });
const ParticleWorld = dynamic(() => import("../components/ParticleWorld"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-ash-gray" role="status">Preparando partículas…</div> });

const subscribePreview = () => () => {};
export default function Home() {
  const [flow, dispatch] = useReducer(locationFlowReducer, initialLocationFlow);
  const [mapLocation, setMapLocation] = useState<LocationResult | null>(null);
  const [introStage, setIntroStage] = useState<HeroIntroStage>("settled");
  const skipIntro = useRef<() => void>(() => {});
  const particlesPreview = useSyncExternalStore(subscribePreview, () => new URLSearchParams(window.location.search).get("particles") === "1", () => false);
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
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (particlesPreview || reducedMotion || !webglAvailable) return;
    let cancelFrame = () => {};
    const startTimer = window.setTimeout(() => {
      const start = performance.now();
      let frame = 0;
      let previousStage: HeroIntroStage = "settled";
      const tick = (now: number) => {
        const elapsed = now - start;
        const nextStage = getHeroIntroStage(elapsed);
        if (nextStage !== previousStage) { previousStage = nextStage; setIntroStage(nextStage); }
        if (elapsed < HERO_INTRO_DURATION_MS) frame = window.requestAnimationFrame(tick);
        else setIntroStage("settled");
      };
      setIntroStage("scatter");
      frame = window.requestAnimationFrame(tick);
      cancelFrame = () => window.cancelAnimationFrame(frame);
      skipIntro.current = () => { cancelFrame(); setIntroStage("settled"); };
    }, 80);
    return () => { window.clearTimeout(startTimer); cancelFrame(); };
  }, [particlesPreview, reducedMotion, webglAvailable]);


  useEffect(() => {
    if (flow.status !== "flying" && flow.status !== "transitioning") return;
    const instant = reducedMotion || !webglAvailable;
    const delay = flow.status === "flying" ? (instant ? 0 : 1800) : (instant ? 0 : 500);
    const timer = window.setTimeout(() => dispatch({ type: "vueloTerminado", instantaneo: instant }), delay);
    return () => window.clearTimeout(timer);
  }, [flow.status, reducedMotion, webglAvailable]);

  const onLocationSelected = (selected: LocationResult) => { setMapLocation(null); dispatch({ type: "buscar", location: selected }); };
  const onGpsLocationSelected = (selected: LocationResult, accuracyMeters: number) => { setMapLocation(null); dispatch({ type: "gpsOk", location: selected, accuracyMeters }); };
  const onBackToGlobe = () => { setMapLocation(null); dispatch({ type: "volver" }); };
  const globeFading = flow.status === "transitioning";

  return <main id="inicio" className="min-h-screen overflow-hidden bg-void text-bone-white">
    {!showMap ? <section className="mx-auto grid min-h-[calc(100svh-76px)] w-full max-w-[1440px] grid-cols-1 items-center px-5 pb-8 pt-2 sm:px-10 lg:min-h-[calc(100svh-88px)] lg:grid-cols-[0.88fr_1.12fr] lg:gap-3 lg:px-12 lg:py-8">
      <div className={`relative z-10 order-2 mx-auto w-full max-w-[580px] text-center lg:order-1 lg:mx-0 lg:text-left hero-copy-${introStage}`}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-saffron-spark sm:text-sm">NASA · agricultura · futuro</p>
        <h1 className="font-display text-[clamp(3.5rem,9vw,7rem)] font-normal leading-[0.92] tracking-[-0.055em]">HEIMDALL</h1>
        <p className="mt-5 text-xl font-light leading-relaxed text-silver-mist sm:text-2xl">Decide qué sembrar con datos de la NASA.</p>
        <p className="mx-auto mt-3 max-w-[460px] text-sm leading-7 text-ash-gray sm:text-base lg:mx-0">Marca tu finca y compara rotaciones de cultivo con evidencia, riesgos y lo que aún no sabemos.</p>
        <div className="mt-7"><LocationSearch onLocationSelected={onLocationSelected} onGpsStart={() => dispatch({ type: "locating" })} onGpsLocationSelected={onGpsLocationSelected} onGpsError={(message) => dispatch({ type: "gpsError", message })} /></div>
      </div>
      <div className={`relative isolate order-1 mx-auto h-[min(39svh,340px)] w-full max-w-[610px] transition-opacity duration-500 motion-reduce:transition-none sm:h-[min(48svh,460px)] lg:order-2 lg:h-[min(78svh,740px)] ${globeFading ? "opacity-0" : "opacity-100"}`} aria-hidden={showMap}>
        <div className={`absolute inset-0 transition-opacity duration-700 ${introStage === "scatter" || introStage === "gather" || introStage === "hold" || introStage === "explode" ? "opacity-0" : "opacity-100"} ${introStage === "explode" ? "hero-globe-spin" : ""}`}>
          <GlobeScene location={location} active={!showMap && !globeFading} introSpin={introStage === "explode"} />
        </div>
        {!particlesPreview && introStage !== "settled" && <ParticleWorld stage={introStage} />}
        {particlesPreview && <ParticleWorld stage="preview" />}
      </div>
      {introStage !== "settled" && !particlesPreview && <button type="button" onClick={() => skipIntro.current()} className="fixed right-5 top-24 z-30 rounded-full border border-white/30 bg-black px-4 py-2 text-xs text-white focus-visible:outline-2 focus-visible:outline-saffron-spark">Saltar</button>}
      {flow.status === "flying" && location && <p className="order-3 text-center text-sm text-saffron-spark" role="status" aria-live="polite">Volando hacia {location.label}…</p>}
      <footer className="order-4 mt-2 space-y-1 text-center text-xs text-ash-gray lg:col-span-2"><p>© Colaboradores de OpenStreetMap</p><p>Imagen: NASA Blue Marble, con tratamiento de color propio</p></footer>
    </section> : <section className="mx-auto w-full max-w-[1440px] px-4 pb-5 pt-2 sm:px-8">
      <div className="mb-3 flex items-baseline justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-saffron-spark">Ubicación de la finca</p><h1 className="mt-1 text-2xl font-normal tracking-tight sm:text-3xl">HEIMDALL</h1></div><p className="hidden text-sm text-ash-gray sm:block">Rotaciones de cultivo con datos de la NASA</p></div>
      {location && <MapScene location={mapLocation ?? location} gpsAccuracyMeters={gpsAccuracyMeters} onLocationSelected={setMapLocation} onBack={onBackToGlobe} onConfirmed={() => dispatch({ type: "confirmar" })} />}
    </section>}
  </main>;
}
