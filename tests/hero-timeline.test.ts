import { describe, expect, it } from "vitest";
import {
  HERO_INTRO_DURATION_MS,
  getEnteringHeroState,
  getInitialHeroState,
  getSettledHeroState,
} from "../src/lib/ui/heroTimeline";

describe("heroTimeline", () => {
  it("starts usable before the intro mounts", () => {
    expect(getInitialHeroState()).toBe("settled");
  });

  it("provides a bounded entering phase and a settled phase", () => {
    expect(getEnteringHeroState()).toBe("entering");
    expect(getSettledHeroState()).toBe("settled");
    expect(HERO_INTRO_DURATION_MS).toBeGreaterThan(500);
    expect(HERO_INTRO_DURATION_MS).toBeLessThan(1000);
  });
});
