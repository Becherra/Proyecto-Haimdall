import { describe, expect, it } from "vitest";
import { resolveIntroPolicy } from "../src/lib/ui/introPolicy";

describe("resolveIntroPolicy", () => {
  const ready = { enabled: true, reducedMotion: false, sessionSeen: false, webglAvailable: true };

  it("animates only when all prerequisites are ready", () => {
    expect(resolveIntroPolicy(ready)).toEqual({ animate: true, reason: "ready" });
  });

  it.each([
    ["disabled", { ...ready, enabled: false }],
    ["reduced-motion", { ...ready, reducedMotion: true }],
    ["session-seen", { ...ready, sessionSeen: true }],
    ["webgl-unavailable", { ...ready, webglAvailable: false }],
  ] as const)("does not animate when %s", (reason, input) => {
    expect(resolveIntroPolicy(input)).toEqual({ animate: false, reason });
  });
});
