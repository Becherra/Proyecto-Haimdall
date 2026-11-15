import { describe, expect, it } from "vitest";
import { buildCropHealthNotes, measuresForStage, NO_CLIMATE_LINK, NOT_A_DIAGNOSIS } from "../src/lib/cropHealthNotes";
import { CROP_PROFILES, getCropProfile } from "../src/lib/cropProfiles";
import type { CropProfileSelection } from "../src/types";

const notes = (selection: CropProfileSelection) => {
  const result = buildCropHealthNotes(CROP_PROFILES, selection);
  if (!result) throw new Error("Se esperaba un resumen");
  return result;
};

describe("resumen honesto de sanidad", () => {
  it("presenta la observación como posible y sin confirmar, nunca como diagnóstico", () => {
    const result = notes({ cropId: "cafe", cultivarId: "caturra", stageId: "produccion", observedThreatId: "roya" });
    expect(result.observation?.status).toBe("observacion-sin-confirmar");
    expect(result.observation?.heading).toMatch(/posible roya del cafeto \(sin confirmar\)/);
    expect(result.disclaimer).toBe(NOT_A_DIAGNOSIS);
    expect(JSON.stringify(result)).not.toMatch(/tu cultivo tiene|diagnóstico confirmado/i);
  });

  it("cita la respuesta documentada de la variedad con su fuente", () => {
    const susceptible = notes({ cropId: "cafe", cultivarId: "caturra", stageId: "produccion", observedThreatId: "roya" });
    expect(susceptible.observation?.cultivarResponse?.text).toMatch(/Caturra está documentada como susceptible/);
    expect(susceptible.observation?.cultivarResponse?.sources[0].label).toMatch(/Cenicafé/);
    const resistant = notes({ cropId: "cafe", cultivarId: "castillo-general", stageId: "produccion", observedThreatId: "roya" });
    expect(resistant.observation?.cultivarResponse?.context).toMatch(/hojas de abajo/);
  });

  it("declara el vacío cuando los síntomas no están documentados", () => {
    const result = notes({ cropId: "cafe", cultivarId: "castillo-general", stageId: "produccion", observedThreatId: "roya" });
    expect(result.observation?.symptomsToCompare).toBeUndefined();
    expect(result.gaps.join(" ")).toMatch(/no describen los síntomas/);
  });

  it("exige confirmación oficial ante una sospecha de moko y no generaliza medidas químicas", () => {
    const result = notes({ cropId: "platano", cultivarId: "dominico-harton", plantingMaterialId: "colino", stageId: "vegetativo", observedThreatId: "moko" });
    expect(result.observation?.officialNotice).toMatch(/Requiere confirmación: avisa al ICA/);
    expect(result.observation?.officialNotice).toMatch(/Resolución ICA 092770 de 2021/);
    expect(result.observation?.measures.map((measure) => measure.id)).toContain("moko-confirmar-ica");
    expect(result.gaps.join(" ")).toMatch(/No hay datos verificados de cómo responde Dominico Hartón/);
  });

  it("con «No sé» en todo no bloquea y lista los vacíos", () => {
    const result = notes({ cropId: "platano", cultivarId: "unknown", stageId: "unknown", observedThreatId: "unknown" });
    expect(result.cultivar.label).toBe("Variedad sin indicar");
    expect(result.stage.label).toBe("Etapa sin indicar");
    expect(result.observation).toBeUndefined();
    expect(result.gaps).toContain(NO_CLIMATE_LINK);
    expect(result.gaps.length).toBeGreaterThanOrEqual(4);
  });

  it("nombra la otra variedad pero aclara que no hay datos de ella", () => {
    const result = notes({ cropId: "cafe", cultivarId: "other", otherCultivarName: "Geisha", stageId: "produccion" });
    expect(result.cultivar.label).toBe("Geisha");
    expect(result.gaps[0]).toMatch(/«Geisha» no está en el catálogo piloto/);
  });

  it("devuelve la descripción del agricultor tal cual, sin interpretarla", () => {
    const result = notes({ cropId: "cafe", cultivarId: "unknown", stageId: "unknown", observedThreatId: "none", symptomsNote: "manchas naranjas en hojas de abajo" });
    expect(result.userNote).toBe("manchas naranjas en hojas de abajo");
    expect(result.observation).toBeUndefined();
  });

  it("devuelve undefined para un cultivo sin perfil", () => {
    expect(buildCropHealthNotes(CROP_PROFILES, { cropId: "maiz", cultivarId: "unknown", stageId: "unknown" })).toBeUndefined();
  });
});

describe("medidas por etapa", () => {
  const broca = getCropProfile(CROP_PROFILES, "cafe")?.threats.find((threat) => threat.id === "broca");

  it("filtra por etapa y muestra todas si la etapa es desconocida", () => {
    if (!broca) throw new Error("Falta broca");
    expect(measuresForStage(broca, "renovacion-zoca").map((measure) => measure.id)).toEqual(["broca-recolectar-antes-zoca"]);
    expect(measuresForStage(broca, "unknown")).toHaveLength(broca.measures.length);
    expect(measuresForStage(broca, "almacigo")).toEqual([]);
  });
});
