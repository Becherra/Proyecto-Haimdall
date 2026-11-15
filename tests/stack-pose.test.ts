import { describe, expect, it } from "vitest";
import { stackPose } from "../src/lib/ui/stackPose";

describe("stackPose", () => {
  it("deja la tarjeta activa al frente, sin desplazamiento", () => {
    expect(stackPose(0)).toEqual({ y: 0, yPercent: 0, rotation: 0, scale: 1, opacity: 1 });
  });

  it("saca las tarjetas ya contestadas por arriba y las oculta", () => {
    const pose = stackPose(-1);
    expect(pose.yPercent).toBeLessThan(-100);
    expect(pose.opacity).toBe(0);
    expect(stackPose(-3)).toEqual(pose);
  });

  it("hace asomar las siguientes más abajo, más pequeñas y más tenues", () => {
    const first = stackPose(1);
    const second = stackPose(2);
    expect(first.y).toBeGreaterThan(0);
    expect(second.y).toBeGreaterThan(first.y);
    expect(second.scale).toBeLessThan(first.scale);
    expect(second.opacity).toBeLessThan(first.opacity);
  });

  it("oculta las tarjetas demasiado profundas", () => {
    expect(stackPose(3).opacity).toBe(0);
    expect(stackPose(10).opacity).toBe(0);
  });
});
