import { describe, expect, it } from "vitest";
import { applySelection, selectionFromPriorities } from "../src/lib/ui/prioritySelection";
import { userPrioritiesSchema } from "../src/types";
import type { UserPriorities } from "../src/types";

const base: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3, currentCropId: "maiz", waterAvailability: "low", slopePercent: 12 };

describe("applySelection", () => {
  it("da peso máximo a lo tocado y peso bajo al resto", () => {
    const result = applySelection(base, ["waterSaving", "lowRisk"]);
    expect(result).toMatchObject({ waterSaving: 5, lowRisk: 5, extraIncome: 1, soilImprovement: 1, erosionReduction: 1 });
  });
  it("sin selección deja todo neutro", () => {
    expect(applySelection(base, [])).toMatchObject({ waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 });
  });
  it("conserva cultivo, agua y datos opcionales, y es válido para el esquema", () => {
    const result = applySelection(base, ["soilImprovement"]);
    expect(result).toMatchObject({ currentCropId: "maiz", waterAvailability: "low", slopePercent: 12 });
    expect(userPrioritiesSchema.safeParse(result).success).toBe(true);
  });
  it("no modifica el objeto original", () => {
    applySelection(base, ["waterSaving"]);
    expect(base.waterSaving).toBe(3);
  });
});

describe("selectionFromPriorities", () => {
  it("marca solo las prioridades altas", () => {
    expect(selectionFromPriorities({ ...base, waterSaving: 5, lowRisk: 4, extraIncome: 2 })).toEqual(["waterSaving", "lowRisk"]);
  });
  it("devuelve vacío con pesos neutros", () => {
    expect(selectionFromPriorities(base)).toEqual([]);
  });
  it("ida y vuelta con applySelection", () => {
    expect(selectionFromPriorities(applySelection(base, ["erosionReduction", "extraIncome"]))).toEqual(["extraIncome", "erosionReduction"]);
  });
});

describe("respuesta de cultivo · Ninguno", () => {
  it("«Ninguno» marca noCurrentCrop y no manda cultivo", async () => {
    const { cropAnswerFields, NO_CROP } = await import("../src/lib/ui/prioritySelection");
    expect(cropAnswerFields(NO_CROP)).toEqual({ currentCropId: undefined, noCurrentCrop: true });
  });
  it("un cultivo elegido se manda tal cual y sin la marca", async () => {
    const { cropAnswerFields } = await import("../src/lib/ui/prioritySelection");
    expect(cropAnswerFields("papa")).toEqual({ currentCropId: "papa", noCurrentCrop: undefined });
    expect(cropAnswerFields(null)).toEqual({ currentCropId: undefined, noCurrentCrop: undefined });
  });
  it("ida y vuelta al volver a editar", async () => {
    const { cropAnswerFields, cropAnswerFromPriorities } = await import("../src/lib/ui/prioritySelection");
    for (const answer of ["none", "yuca", null]) expect(cropAnswerFromPriorities(cropAnswerFields(answer))).toBe(answer);
  });
  it("el resultado de applySelection con «Ninguno» es válido para el esquema", async () => {
    const { cropAnswerFields } = await import("../src/lib/ui/prioritySelection");
    expect(userPrioritiesSchema.safeParse(applySelection({ ...base, ...cropAnswerFields("none"), currentCropId: undefined }, ["lowRisk"])).success).toBe(true);
  });
});
