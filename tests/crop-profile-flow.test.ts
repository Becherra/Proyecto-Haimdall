import { describe, expect, it } from "vitest";
import { CROP_PROFILES } from "../src/lib/cropProfiles";
import { draftFromSelection, isStepAnswered, profileOptions, profileStepsFor, startingCardIndex, toProfileSelection } from "../src/lib/ui/cropProfileFlow";
import { cropProfileSelectionSchema } from "../src/types";

describe("startingCardIndex", () => {
  it("cae en la pregunta pedida: la etapa del café es la tercera tarjeta (cultivo, variedad, etapa)", () => {
    expect(startingCardIndex(CROP_PROFILES, "cafe", "stage")).toBe(2);
    expect(startingCardIndex(CROP_PROFILES, "platano", "stage")).toBe(3);
  });

  it("empieza por la primera pregunta si no se pide una o el cultivo no tiene esa pregunta", () => {
    expect(startingCardIndex(CROP_PROFILES, "cafe", undefined)).toBe(0);
    expect(startingCardIndex(CROP_PROFILES, "cafe", "material")).toBe(0);
    expect(startingCardIndex(CROP_PROFILES, "maiz", "stage")).toBe(0);
    expect(startingCardIndex(CROP_PROFILES, null, "stage")).toBe(0);
  });
});

describe("flujo cultivo → variedad → etapa → problema", () => {
  it("solo pregunta de más para cultivos con perfil; el plátano incluye el material de siembra", () => {
    expect(profileStepsFor(CROP_PROFILES, "cafe")).toEqual(["cultivar", "stage", "problem"]);
    expect(profileStepsFor(CROP_PROFILES, "platano")).toEqual(["cultivar", "material", "stage", "problem"]);
    expect(profileStepsFor(CROP_PROFILES, "maiz")).toEqual([]);
    expect(profileStepsFor(CROP_PROFILES, null)).toEqual([]);
  });

  it("toda pregunta ofrece «No sé»; variedad ofrece «Otra variedad»", () => {
    for (const cropId of ["cafe", "platano"]) {
      for (const step of profileStepsFor(CROP_PROFILES, cropId)) {
        expect(profileOptions(CROP_PROFILES, cropId, step).map((option) => option.label), `${cropId}/${step}`).toContain("No sé");
      }
    }
    expect(profileOptions(CROP_PROFILES, "cafe", "cultivar").at(-2)?.label).toBe("Otra variedad");
    expect(profileOptions(CROP_PROFILES, "maiz", "cultivar")).toEqual([]);
  });

  it("la variedad y la etapa piden respuesta; el problema es opcional", () => {
    expect(isStepAnswered("cultivar", {})).toBe(false);
    expect(isStepAnswered("cultivar", { cultivarId: "unknown" })).toBe(true);
    expect(isStepAnswered("stage", {})).toBe(false);
    expect(isStepAnswered("problem", {})).toBe(true);
  });

  it("arma una selección válida y rellena lo que falte con «No sé»", () => {
    const selection = toProfileSelection(CROP_PROFILES, "platano", { cultivarId: "other", otherCultivarName: "  África ", symptomsNote: "   " });
    expect(selection).toEqual({ cropId: "platano", cultivarId: "other", otherCultivarName: "África", plantingMaterialId: "unknown", stageId: "unknown", observedThreatId: undefined, symptomsNote: undefined });
    expect(cropProfileSelectionSchema.safeParse(selection).success).toBe(true);
  });

  it("descarta el nombre libre si al final eligió una variedad del catálogo y no pregunta material en café", () => {
    const selection = toProfileSelection(CROP_PROFILES, "cafe", { cultivarId: "tabi", otherCultivarName: "Geisha", stageId: "produccion" });
    expect(selection?.otherCultivarName).toBeUndefined();
    expect(selection?.plantingMaterialId).toBeUndefined();
    expect(toProfileSelection(CROP_PROFILES, "maiz", {})).toBeUndefined();
  });

  it("recupera las respuestas al volver a editar", () => {
    const selection = toProfileSelection(CROP_PROFILES, "cafe", { cultivarId: "caturra", stageId: "produccion", observedThreatId: "roya" });
    expect(draftFromSelection(selection)).toMatchObject({ cultivarId: "caturra", stageId: "produccion", observedThreatId: "roya" });
    expect(draftFromSelection(undefined)).toEqual({});
  });
});
