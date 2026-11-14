"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import ParticleField from "./ParticleField";
import { getEnteringHeroState, getInitialHeroState, getSettledHeroState, HERO_INTRO_DURATION_MS, type HeroIntroState } from "../lib/ui/heroTimeline";
import { resolveIntroPolicy } from "../lib/ui/introPolicy";

type HeroEntranceProps = {
  globe: ReactNode;
  copy: ReactNode;
  actions: ReactNode;
  forceSettled?: boolean;
  onSettled?: () => void;
  children?: ReactNode;
};

function readSessionSeen(): boolean {
  try { return sessionStorage.getItem("heimdall.hero-intro-seen") === "1"; } catch { return false; }
}

function markSessionSeen(): void {
  try { sessionStorage.setItem("heimdall.hero-intro-seen", "1"); } catch { /* Storage may be blocked. */ }
}

function hasWebGl(): boolean {
  try { return Boolean(document.createElement("canvas").getContext("webgl")); } catch { return false; }
}

export default function HeroEntrance({ globe, copy, actions, forceSettled = false, onSettled, children }: HeroEntranceProps) {
  const [state, setState] = useState<HeroIntroState>(getInitialHeroState);
  const settledNotified = useRef(false);
  const content = children ?? <div className="hero-slot-grid"><div>{copy}</div><div>{globe}</div><div>{actions}</div></div>;

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const enabled = process.env.NEXT_PUBLIC_HERO_INTRO !== "false";
    const policy = resolveIntroPolicy({ enabled, reducedMotion, sessionSeen: readSessionSeen(), webglAvailable: hasWebGl() });
    if (forceSettled || !policy.animate) {
      const frame = window.requestAnimationFrame(() => {
        setState(getSettledHeroState());
        onSettled?.();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setState(getEnteringHeroState()));
    const timer = window.setTimeout(() => {
      setState(getSettledHeroState());
      markSessionSeen();
      onSettled?.();
    }, HERO_INTRO_DURATION_MS);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [forceSettled, onSettled]);

  useEffect(() => {
    const skip = () => setState(getSettledHeroState());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") skip();
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("a")) skip();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("click", onClick); };
  }, []);

  useEffect(() => {
    if (state === "settled" && !settledNotified.current) settledNotified.current = true;
  }, [state]);

  return <div className={`hero-entrance ${state === "entering" ? "hero-entrance-entering" : "hero-entrance-settled"}`}>
    <ParticleField />
    <div className="relative z-10">{content}</div>
  </div>;
}
