export type HeroIntroState = "settled" | "entering";
export type HeroIntroStage = "scatter" | "gather" | "hold" | "explode" | "globe" | "settled";

/**
 * Instante (ms) en el que TERMINA cada etapa de la intro.
 * scatter: triángulos dispersos aparecen flotando
 * gather : los triángulos vuelan y se ensamblan en la esfera
 * hold   : el mundo de triángulos queda formado (respira / brilla)
 * explode: los triángulos se expanden y se desvanecen mientras aparece tu globo real
 * globe  : el globo real ya es visible, entra el texto del hero
 */
export const HERO_TIMELINE = { scatter: 500, gather: 3000, hold: 3500, explode: 4200, globe: 5200 } as const;
export const HERO_INTRO_DURATION_MS = HERO_TIMELINE.globe;

const STAGE_BOUNDS: Record<Exclude<HeroIntroStage, "settled">, readonly [number, number]> = {
  scatter: [0, HERO_TIMELINE.scatter],
  gather: [HERO_TIMELINE.scatter, HERO_TIMELINE.gather],
  hold: [HERO_TIMELINE.gather, HERO_TIMELINE.hold],
  explode: [HERO_TIMELINE.hold, HERO_TIMELINE.explode],
  globe: [HERO_TIMELINE.explode, HERO_TIMELINE.globe],
};

export function getInitialHeroState(): HeroIntroState { return "settled"; }
export function getEnteringHeroState(): HeroIntroState { return "entering"; }
export function getSettledHeroState(): HeroIntroState { return "settled"; }

export function getHeroIntroStage(elapsedMs: number): HeroIntroStage {
  if (elapsedMs < HERO_TIMELINE.scatter) return "scatter";
  if (elapsedMs < HERO_TIMELINE.gather) return "gather";
  if (elapsedMs < HERO_TIMELINE.hold) return "hold";
  if (elapsedMs < HERO_TIMELINE.explode) return "explode";
  if (elapsedMs < HERO_TIMELINE.globe) return "globe";
  return "settled";
}

export function getHeroStageProgress(elapsedMs: number): number {
  const stage = getHeroIntroStage(elapsedMs);
  if (stage === "settled") return 1;
  const [start, end] = STAGE_BOUNDS[stage];
  return Math.max(0, Math.min(1, (elapsedMs - start) / (end - start)));
}
