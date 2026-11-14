import { describe, expect, it } from "vitest";
import {
  HERO_INTRO_DURATION_MS,
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
    expect(HERO_INTRO_DURATION_MS).toBe(4200);
  });

  it("maps the full entrance to its choreography stages", () => {
    expect(getHeroIntroStage(0)).toBe("scatter");
    expect(getHeroIntroStage(800)).toBe("gather");
    expect(getHeroIntroStage(2400)).toBe("hold");
    expect(getHeroIntroStage(2900)).toBe("explode");
    expect(getHeroIntroStage(3500)).toBe("globe");
    expect(getHeroIntroStage(4200)).toBe("settled");
    expect(getHeroStageProgress(2600)).toBe(0);
  });
});
