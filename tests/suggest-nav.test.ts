import { describe, expect, it } from "vitest";
import { moveHighlight } from "../src/lib/ui/suggestNav";

describe("moveHighlight", () => {
  it("baja desde ninguna opción hasta la primera y da la vuelta al final", () => {
    expect(moveHighlight(-1, 3, "ArrowDown")).toBe(0);
    expect(moveHighlight(1, 3, "ArrowDown")).toBe(2);
    expect(moveHighlight(2, 3, "ArrowDown")).toBe(0);
  });

  it("sube desde ninguna opción hasta la última y da la vuelta al inicio", () => {
    expect(moveHighlight(-1, 3, "ArrowUp")).toBe(2);
    expect(moveHighlight(0, 3, "ArrowUp")).toBe(2);
    expect(moveHighlight(2, 3, "ArrowUp")).toBe(1);
  });

  it("devuelve -1 si la lista está vacía", () => {
    expect(moveHighlight(0, 0, "ArrowDown")).toBe(-1);
  });
});
