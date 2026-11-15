"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "./motion";

/** Resplandor oliva detrás del globo; "respira" despacio para que la portada no esté quieta. */
export default function GlobeGlow() {
  const glow = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(glow.current, { scale: 0.94, opacity: 0.75 }, { scale: 1.06, opacity: 1, duration: 4.5, ease: "sine.inOut", repeat: -1, yoyo: true });
  }, { scope: glow });
  return <div ref={glow} className="globe-glow" aria-hidden="true" />;
}
