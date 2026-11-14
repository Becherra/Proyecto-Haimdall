export const HERO_INTRO_DURATION_MS = 720;

export type HeroIntroState = "settled" | "entering";

export function getInitialHeroState(): HeroIntroState {
  return "settled";
}

export function getEnteringHeroState(): HeroIntroState {
  return "entering";
}

export function getSettledHeroState(): HeroIntroState {
  return "settled";
}
