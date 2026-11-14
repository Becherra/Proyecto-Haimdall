import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockAnalysisResponse } from "../src/mocks";
import { scoreRotations } from "../src/lib/scoring";
import { cropSchema } from "../src/types";

const raw = JSON.parse(readFileSync("data/crops.json", "utf8")) as unknown[];

describe("data/crops.json", () => {
  it("cumple el esquema Crop en todos los cultivos", () => {
    expect(raw.length).toBeGreaterThan(0);
    for (const crop of raw) expect(cropSchema.safeParse(crop).success).toBe(true);
  });

  it("tiene ids únicos y meses de siembra válidos, sin repetir", () => {
    const crops = raw.map((crop) => cropSchema.parse(crop));
    expect(new Set(crops.map((crop) => crop.id)).size).toBe(crops.length);
    for (const { sowingMonths } of crops) {
      expect(sowingMonths.length).toBeGreaterThan(0);
      expect(new Set(sowingMonths).size).toBe(sowingMonths.length);
    }
  });

  it("declara en cada fuente que los puntajes son preliminares y apunta a la rúbrica", () => {
    for (const { source } of raw.map((crop) => cropSchema.parse(crop))) {
      expect(source).toContain("preliminares");
      expect(source).toContain("docs/crops-rubric.md");
    }
  });

  it("incluye los cultivos anuales de clima frío de la primera ampliación", () => {
    const byId = new Map(raw.map((crop) => cropSchema.parse(crop)).map((crop) => [crop.id, crop]));
    for (const id of ["papa", "avena", "repollo"]) expect(byId.has(id)).toBe(true);
    // Ninguno es leguminosa: no fijan nitrógeno.
    for (const id of ["papa", "avena", "repollo"]) expect(byId.get(id)?.nitrogenFixation).toBe(0);
  });

  it("mantiene el ciclo de los cultivos nuevos dentro del rango que da su fuente", () => {
    const byId = new Map(raw.map((crop) => cropSchema.parse(crop)).map((crop) => [crop.id, crop]));
    // FAO Land & Water: papa 90–180 días según variedad; repollo 90–200 días según clima y variedad.
    expect(byId.get("papa")?.cycleDays).toBeGreaterThanOrEqual(90);
    expect(byId.get("papa")?.cycleDays).toBeLessThanOrEqual(180);
    expect(byId.get("repollo")?.cycleDays).toBeGreaterThanOrEqual(90);
    expect(byId.get("repollo")?.cycleDays).toBeLessThanOrEqual(200);
    // Campuzano-Duque et al. 2020 (AGROSAVIA): avena Altoandina, 111–165 días a cosecha de forraje verde.
    expect(byId.get("avena")?.cycleDays).toBeGreaterThanOrEqual(111);
    expect(byId.get("avena")?.cycleDays).toBeLessThanOrEqual(165);
  });

  it("tiene al menos cuatro cultivos poco tolerantes al calor para poder armar tres rotaciones en zona fría", () => {
    const coolCrops = raw.map((crop) => cropSchema.parse(crop)).filter((crop) => crop.heatTolerance <= 1);
    expect(coolCrops.length).toBeGreaterThanOrEqual(4);
  });

  it("deja a la avena forrajera como el cultivo de mayor valor forrajero", () => {
    const crops = raw.map((crop) => cropSchema.parse(crop));
    const best = Math.max(...crops.map((crop) => crop.forageValue));
    expect(crops.find((crop) => crop.id === "avena")?.forageValue).toBe(best);
  });

  it("trae la familia botánica de cada cultivo, con al menos cinco familias distintas", () => {
    const crops = raw.map((crop) => cropSchema.parse(crop));
    for (const crop of crops) expect(crop.family, crop.id).toBeTruthy();
    const family = (id: string) => crops.find((crop) => crop.id === id)?.family;
    expect(family("maiz")).toBe(family("avena"));
    expect(new Set(["frijol", "soya", "arveja", "mucuna", "crotalaria"].map(family)).size).toBe(1);
    expect(family("papa")).not.toBe(family("repollo"));
    expect(new Set(crops.map((crop) => crop.family)).size).toBeGreaterThanOrEqual(5);
  });

  it("contiene todos los cultivos que usan las rotaciones del mock", () => {
    const ids = new Set(raw.map((crop) => cropSchema.parse(crop).id));
    for (const { rotation } of mockAnalysisResponse.rotations) {
      for (const cropId of rotation.cropIds) expect(ids.has(cropId)).toBe(true);
    }
  });

  it("permite puntuar las rotaciones del mock con el catálogo real", () => {
    const crops = raw.map((crop) => cropSchema.parse(crop));
    const results = scoreRotations({
      rotations: mockAnalysisResponse.rotations.map((entry) => entry.rotation),
      crops,
      indicators: mockAnalysisResponse.indicators,
      priorities: { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 },
    });
    expect(results).toHaveLength(3);
    for (const { score } of results) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    }
  });
});
