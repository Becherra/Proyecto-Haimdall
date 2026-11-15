"use client";

import { useEffect, useState } from "react";
import { getInstallMode, type InstallMode } from "../lib/pwa";

/** Evento no estándar de Chromium; TypeScript no lo trae en `lib.dom`. */
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Registra el service worker (solo en producción) y ofrece "Instalar app" cuando el navegador lo permite. */
export default function InstallApp() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode>("unavailable");
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
    const standalone = window.matchMedia("(display-mode: standalone)");
    const refresh = (event: BeforeInstallPromptEvent | null) => setMode(getInstallMode({
      isStandalone: standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      hasPromptEvent: event !== null,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
    }));
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); refresh(event as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstallEvent(null); refresh(null); setMode("installed"); };
    refresh(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (mode === "ios-manual") { setShowIosHelp((open) => !open); return; }
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setMode("unavailable");
  }

  if (mode !== "prompt" && mode !== "ios-manual") return null;
  return <div className="relative">
    <button type="button" onClick={install} aria-expanded={mode === "ios-manual" ? showIosHelp : undefined} className="rounded-full border border-cream/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition hover:bg-cream hover:text-meadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream">
      Instalar app
    </button>
    {mode === "ios-manual" && showIosHelp && <p role="status" className="absolute right-0 top-full z-50 mt-3 w-64 rounded-2xl bg-moss p-4 text-left text-sm leading-relaxed text-bone-white shadow-xl">
      En Safari toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
    </p>}
  </div>;
}
