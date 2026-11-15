import { describe, expect, it } from "vitest";
import { generateFibonacciSphere, getParticleColor, isLandPixel, sampleWholeSurface } from "../src/lib/ui/particleGeometry";

describe("particle geometry", () => {
  it("keeps both hemispheres when reducing the land samples", () => {
    const samples = sampleWholeSurface(generateFibonacciSphere(21000), 3500);
    expect(samples).toHaveLength(3500);
    expect(samples[0][1]).toBeGreaterThan(0.99);
    expect(samples.at(-1)![1]).toBeLessThan(-0.99);
    expect(sampleWholeSurface([], 3500)).toEqual([]);
  });
  it("creates a repeatable Fibonacci distribution on the requested radius", () => {
    const first = generateFibonacciSphere(3500, 10);
    const second = generateFibonacciSphere(3500, 10);

    expect(first).toHaveLength(3500);
    expect(first[0]).toEqual(second[0]);
    expect(Math.hypot(...first[42])).toBeCloseTo(10, 8);
  });

  it("uses the Blue Marble green and blue channels to separate land and ocean", () => {
    expect(isLandPixel(48, 92, 50)).toBe(true);
    expect(isLandPixel(8, 9, 40)).toBe(false);
  });

  it("keeps chromatic patches stable for the same position and index", () => {
    const position = [0.2, -0.5, 0.84] as [number, number, number];
    expect(getParticleColor(position)).toBe(getParticleColor(position));
    expect(["#EAD39D", "#737F35", "#B5C266", "#F8EFD2"]).toContain(getParticleColor(position));
  });

  it("rejects invalid sphere dimensions", () => {
    expect(() => generateFibonacciSphere(-1)).toThrow(RangeError);
    expect(() => generateFibonacciSphere(1, Number.NaN)).toThrow(RangeError);
  });
});
