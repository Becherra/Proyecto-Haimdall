import { describe, expect, it } from "vitest";
import { buildLassoPolygon, simplifyPath, trimLassoLoop } from "../src/lib/geo/lasso";
import type { PixelPoint } from "../src/lib/geo/lasso";

/** Cuadrado de 100 px recorrido con muchos puntos, como lo haría un dedo. */
function squareStroke(overshoot = false): PixelPoint[] {
  const points: PixelPoint[] = [];
  for (let step = 0; step <= 100; step += 5) points.push([step, 0]);
  for (let step = 5; step <= 100; step += 5) points.push([100, step]);
  for (let step = 95; step >= 0; step -= 5) points.push([step, 100]);
  for (let step = 95; step >= (overshoot ? -20 : 5); step -= 5) points.push([0, step]);
  return points;
}

describe("simplifyPath", () => {
  it("reduce una línea recta a sus dos extremos", () => {
    const line: PixelPoint[] = Array.from({ length: 20 }, (_, index) => [index, index * 2]);
    expect(simplifyPath(line, 1)).toEqual([[0, 0], [19, 38]]);
  });
  it("conserva las esquinas de un cuadrado", () => {
    expect(simplifyPath(squareStroke(), 6).length).toBeLessThanOrEqual(6);
  });
});

describe("trimLassoLoop", () => {
  it("elimina el tramo que sobrepasa el punto de inicio", () => {
    const trimmed = trimLassoLoop(squareStroke(true));
    expect(trimmed.every(([x, y]) => x >= 0 && y >= 0)).toBe(true);
  });
  it("deja intacto un trazo que no se cruza", () => {
    const arc: PixelPoint[] = Array.from({ length: 12 }, (_, index) => [index * 10, index * index]);
    expect(trimLassoLoop(arc)).toEqual(arc);
  });
});

describe("buildLassoPolygon", () => {
  it("convierte un cuadrado dibujado a mano en pocos vértices", () => {
    const polygon = buildLassoPolygon(squareStroke());
    expect(polygon).not.toBeNull();
    expect(polygon!.length).toBeGreaterThanOrEqual(4);
    expect(polygon!.length).toBeLessThanOrEqual(8);
  });
  it("rechaza un toque o un trazo demasiado corto", () => {
    expect(buildLassoPolygon([[1, 1], [2, 2]])).toBeNull();
    expect(buildLassoPolygon(Array.from({ length: 10 }, () => [5, 5] as PixelPoint))).toBeNull();
  });
});
