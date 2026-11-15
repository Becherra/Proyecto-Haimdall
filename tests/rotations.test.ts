import { describe, expect, it } from "vitest";
import { CROPS } from "../src/lib/catalog";
import { HIGH_ATTRIBUTE_THRESHOLD, MAX_PEST_CYCLE_PENALTY, NITROGEN_FIXER_THRESHOLD } from "../src/lib/config";
import { baselineRotation, candidateRotations, familyBreakShare, pickBest } from "../src/lib/rotations";
import { scoreRotations } from "../src/lib/scoring";
import type { Crop, Indicators, Rotation, RotationResult, UserPriorities } from "../src/types";

function crop(id: string, family: string | undefined, overrides: Partial<Crop> = {}): Crop {
  return {
    id, name: `${id} (Especie ${id})`, waterUse: 2, nitrogenFixation: 0, erosionReduction: 2, organicMatter: 2, forageValue: 2, marketPotential: 3,
    heatTolerance: 3, droughtTolerance: 3, cycleDays: 100, sowingMonths: [3, 9], source: "Cultivo de prueba", ...(family === undefined ? {} : { family }), ...overrides,
  };
}

const byId = (id: string): Crop => {
  const found = CROPS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Falta ${id} en el catálogo`);
  return found;
};
const WET: Indicators = { waterDeficitMm: 40, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 15, meanRootZoneWetness: 0.8, missingByParameter: {} };
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };

describe("familyBreakShare", () => {
  const grass = crop("grass", "Gramíneas");
  const legume = crop("legume", "Leguminosas");
  const secondLegume = crop("legume2", "Leguminosas");

  it("vale 0 en un monocultivo: el único relevo vuelve a la misma familia", () => {
    expect(familyBreakShare([grass])).toBe(0);
  });

  it("vale 1 cuando todos los relevos cambian de familia, contando la vuelta al primer cultivo", () => {
    expect(familyBreakShare([grass, legume])).toBe(1);
  });

  it("cuenta la fracción de relevos que cambian de familia", () => {
    expect(familyBreakShare([grass, legume, secondLegume])).toBeCloseTo(2 / 3);
    expect(familyBreakShare([legume, secondLegume])).toBe(0);
  });

  it("devuelve null si algún cultivo no trae familia", () => {
    expect(familyBreakShare([grass, crop("unknown", undefined)])).toBeNull();
    expect(familyBreakShare([])).toBeNull();
  });
});

describe("baselineRotation", () => {
  it("usa solo el cultivo actual y conserva el id de la línea base", () => {
    const baseline = baselineRotation(byId("yuca"));
    expect(baseline.id).toBe("baseline");
    expect(baseline.cropIds).toEqual(["yuca"]);
    expect(baseline.name).toContain("Yuca");
  });
});

describe("candidateRotations", () => {
  it("arma la alternativa de leguminosa alrededor del cultivo actual con leguminosas de grano", () => {
    const { legume } = candidateRotations(CROPS, byId("maiz"));
    expect(legume.length).toBeGreaterThan(0);
    for (const rotation of legume) {
      expect(rotation.id).toBe("legume");
      expect(rotation.cropIds[0]).toBe("maiz");
      const partner = byId(rotation.cropIds[1]);
      expect(partner.nitrogenFixation).toBeGreaterThanOrEqual(NITROGEN_FIXER_THRESHOLD);
      // Los abonos verdes (sin mercado propio) pertenecen a la alternativa de cobertura, no a esta.
      expect(["mucuna", "crotalaria"]).not.toContain(partner.id);
    }
  });

  it("si el cultivo actual ya fija nitrógeno, lo combina con cultivos de otra familia que no lo fijan", () => {
    const { legume } = candidateRotations(CROPS, byId("frijol"));
    expect(legume.length).toBeGreaterThan(0);
    for (const rotation of legume) {
      expect(rotation.cropIds[0]).toBe("frijol");
      const partner = byId(rotation.cropIds[1]);
      expect(partner.nitrogenFixation).toBeLessThan(NITROGEN_FIXER_THRESHOLD);
      expect(partner.family).not.toBe(byId("frijol").family);
    }
  });

  it("arma la alternativa de cobertura con el cultivo actual, una cobertura y un cultivo tolerante a sequía, todos distintos", () => {
    const { coverDrought } = candidateRotations(CROPS, byId("maiz"));
    expect(coverDrought.length).toBeGreaterThan(0);
    for (const rotation of coverDrought) {
      expect(rotation.id).toBe("cover-drought");
      const [current, cover, tolerant] = rotation.cropIds.map(byId);
      expect(current.id).toBe("maiz");
      expect(cover.erosionReduction).toBeGreaterThanOrEqual(HIGH_ATTRIBUTE_THRESHOLD);
      expect(tolerant.droughtTolerance).toBeGreaterThanOrEqual(HIGH_ATTRIBUTE_THRESHOLD);
      expect(new Set(rotation.cropIds).size).toBe(3);
    }
  });

  it("no repite el cultivo actual cuando este ya es una cobertura o un cultivo tolerante", () => {
    for (const currentId of ["mucuna", "yuca", "crotalaria"]) {
      const { legume, coverDrought } = candidateRotations(CROPS, byId(currentId));
      for (const rotation of [...legume, ...coverDrought]) expect(rotation.cropIds.filter((id) => id === currentId)).toHaveLength(1);
    }
  });

  it("devuelve listas vacías si el catálogo no alcanza para una alternativa", () => {
    const only = crop("solo", "Gramíneas");
    expect(candidateRotations([only], only)).toEqual({ legume: [], coverDrought: [] });
  });
});

describe("pickBest", () => {
  const result = (id: string, score: number) => ({ rotation: { id, name: id, cropIds: ["x"], description: "d" }, score }) as RotationResult;

  it("elige el puntaje más alto y, en empate, el primero", () => {
    expect(pickBest([result("a", 2), result("b", 3.5), result("c", 3.5)]).rotation.id).toBe("b");
  });

  it("lanza un error si no hay candidatos", () => {
    expect(() => pickBest([])).toThrow();
  });
});

describe("scoreRotations con familias botánicas", () => {
  const maize = crop("maize", "Gramíneas");
  // Mismos atributos que `maize` y otra familia: la única diferencia entre las rotaciones es la alternancia.
  const twin = crop("twin", "Leguminosas");
  const catalog = [maize, twin, crop("nofamily", undefined)];
  const rotation = (id: string, ...cropIds: string[]): Rotation => ({ id, name: id, cropIds, description: "Rotación de prueba" });
  const score = (...rotations: Rotation[]) => scoreRotations({ rotations, crops: catalog, indicators: WET, priorities: EQUAL });

  it("descuenta la penalización completa al monocultivo y nada a la rotación que alterna familias", () => {
    const [mono, alternating] = score(rotation("mono", "maize"), rotation("alt", "maize", "twin"));
    expect(alternating.score - mono.score).toBeCloseTo(MAX_PEST_CYCLE_PENALTY, 2);
  });

  it("explica el monocultivo como riesgo y la alternancia como beneficio, con la evidencia de las familias", () => {
    const [mono, alternating] = score(rotation("mono", "maize"), rotation("alt", "maize", "twin"));
    expect(mono.risks.join(" ")).toContain("monocultivo");
    expect(mono.whySuggested).toContain("familia");
    expect(alternating.benefits.join(" ")).toContain("familias botánicas");
    expect(alternating.evidence.join(" ")).toContain("Gramíneas → Leguminosas");
    expect(alternating.risks.join(" ")).not.toContain("monocultivo");
  });

  it("declara como vacío que no hay datos de plagas del lote", () => {
    const [alternating] = score(rotation("alt", "maize", "twin"));
    expect(alternating.informationGaps.join(" ")).toContain("plagas");
  });

  it("sin familia en el catálogo no penaliza ni premia, y lo dice en los vacíos", () => {
    const [unknown] = score(rotation("u", "nofamily"));
    const [mono] = score(rotation("mono", "maize"));
    expect(unknown.score - mono.score).toBeCloseTo(MAX_PEST_CYCLE_PENALTY, 2);
    expect(unknown.informationGaps.join(" ")).toContain("familia botánica");
    expect(unknown.risks.join(" ")).not.toContain("monocultivo");
  });

  it("muestra la duración de la secuencia sumando los ciclos del catálogo", () => {
    const [alternating] = score(rotation("alt", "maize", "twin"));
    expect(alternating.evidence.join(" ")).toContain("100 + 100 = 200 días");
  });
});

describe("startingRotations: sin cultivo actual", () => {
  it("arma opciones de un solo cultivo, de leguminosa y de cobertura con sequía", async () => {
    const { startingRotations } = await import("../src/lib/rotations");
    const { CROPS } = await import("../src/lib/catalog");
    const candidates = startingRotations(CROPS);
    expect(candidates.single).toHaveLength(CROPS.length);
    expect(candidates.single.every((item) => item.id === "single" && item.cropIds.length === 1 && !item.name.startsWith("Actual"))).toBe(true);
    expect(candidates.legume.length).toBeGreaterThan(0);
    expect(candidates.coverDrought.length).toBeGreaterThan(0);
    expect(candidates.coverDrought.every((item) => new Set(item.cropIds).size === 3)).toBe(true);
  });
});
