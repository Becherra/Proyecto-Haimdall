export const HERO_INTRO_DURATION_MS = 4200;
export type HeroIntroState = "settled" | "entering";
export type HeroIntroStage = "scatter" | "gather" | "hold" | "explode" | "globe" | "settled";

export function getInitialHeroState(): HeroIntroState { return "settled"; }
export function getEnteringHeroState(): HeroIntroState { return "entering"; }
export function getSettledHeroState(): HeroIntroState { return "settled"; }

export function getHeroIntroStage(elapsedMs: number): HeroIntroStage {
  if (elapsedMs < 500) return "scatter";
  if (elapsedMs < 2200) return "gather";
  if (elapsedMs < 2600) return "hold";
  if (elapsedMs < 3200) return "explode";
  if (elapsedMs < HERO_INTRO_DURATION_MS) return "globe";
  return "settled";
}

export function getHeroStageProgress(elapsedMs: number): number {
  const stage = getHeroIntroStage(elapsedMs);
  const start = stage === "scatter" ? 0 : stage === "gather" ? 500 : stage === "hold" ? 2200 : stage === "explode" ? 2600 : stage === "globe" ? 3200 : HERO_INTRO_DURATION_MS;
  const end = stage === "scatter" ? 500 : stage === "gather" ? 2200 : stage === "hold" ? 2600 : stage === "explode" ? 3200 : stage === "globe" ? HERO_INTRO_DURATION_MS : HERO_INTRO_DURATION_MS;
  return end === start ? 1 : Math.max(0, Math.min(1, (elapsedMs - start) / (end - start)));
}
