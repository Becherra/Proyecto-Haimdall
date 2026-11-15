import { describe, expect, it } from "vitest";
import {
  HERO_INTRO_DURATION_MS,
  HERO_TIMELINE,
  getEnteringHeroState,
  getInitialHeroState,
  getSettledHeroState,
  getHeroIntroStage,
  getHeroStageProgress,
} from "../src/lib/ui/heroTimeline";

describe("heroTimeline", () => {
  it("starts usable before the intro mounts", () => {
    expect(getInitialHeroState()).toBe("settled");
  });

  it("provides a bounded entering phase and a settled phase", () => {
    expect(getEnteringHeroState()).toBe("entering");
    expect(getSettledHeroState()).toBe("settled");
    expect(HERO_INTRO_DURATION_MS).toBe(5200);
    expect(HERO_TIMELINE).toEqual({ scatter: 500, gather: 3000, hold: 3500, explode: 4200, globe: 5200 });
  });

  it("maps the full entrance to its choreography stages", () => {
    expect(getHeroIntroStage(0)).toBe("scatter");
    expect(getHeroIntroStage(800)).toBe("gather");
    expect(getHeroIntroStage(3200)).toBe("hold");
    expect(getHeroIntroStage(3900)).toBe("explode");
    expect(getHeroIntroStage(4700)).toBe("globe");
    expect(getHeroIntroStage(5200)).toBe("settled");
    expect(getHeroStageProgress(3500)).toBe(0);
  });
});
