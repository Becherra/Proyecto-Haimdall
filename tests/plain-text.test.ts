import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreRotations } from "../src/lib/scoring";
import { cropSchema, rotationResultSchema, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const crops = (JSON.parse(readFileSync("tests/fixtures/crops-test.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const NO_MISSING = { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0 };
const WET: Indicators = { waterDeficitMm: 50, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 20, meanRootZoneWetness: 0.8, missingByParameter: NO_MISSING };
const DRY: Indicators = { ...WET, waterDeficitMm: -100, heatStressDays: 300 };
const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
const rotation = (id: string, ...cropIds: string[]): Rotation => ({ id, name: id, cropIds, description: "d" });
const plainOf = (cropIds: string[], indicators: Indicators, priorities: UserPriorities = EQUAL, years = 1) => {
  const [result] = scoreRotations({ rotations: [rotation("r", ...cropIds)], crops, indicators, priorities, yearsAnalyzed: years });
  return result!;
};

/** Cifras y siglas técnicas que el campesino no debe ver en la versión simple. */
const JARGON = /T2M|PRECTOTCORR|EVLAND|GWETROOT|Hargreaves|percentil|proxy|SRTM|\d\.\d\/5|mm\/|catálogo|nitrógeno/i;

describe("texto simple de cada rotación", () => {
  it("siempre incluye la versión simple y es válida para el esquema", () => {
    const result = plainOf(["thirsty"], DRY);
    expect(result.plain).toBeDefined();
    expect(rotationResultSchema.safeParse(result).success).toBe(true);
  });

  it("no usa siglas, cifras de puntaje ni palabras técnicas", () => {
    for (const indicators of [WET, DRY]) {
      for (const ids of [["thirsty"], ["tolerant", "legume"], ["cover"]]) {
        const { plain } = plainOf(ids, indicators);
        const all = [plain!.why, ...plain!.benefits, ...plain!.risks, ...plain!.gaps, ...plain!.validate].join(" ");
        expect(all, ids.join()).not.toMatch(JARGON);
      }
    }
  });

  it("explica en pocas palabras lo que más pesa según lo que el agricultor eligió", () => {
    const { plain } = plainOf(["tolerant"], WET, { waterSaving: 5, extraIncome: 0, soilImprovement: 0, erosionReduction: 0, lowRisk: 5 });
    expect(plain!.why).toContain("ahorrar agua");
    expect(plain!.why).toContain("correr menos riesgos");
    expect(plain!.why).toMatch(/ayuda para decidir/);
  });

  it("menciona los problemas que restan puntos con palabras simples", () => {
    const { plain } = plainOf(["thirsty"], DRY);
    expect(plain!.why).toMatch(/calor/);
    expect(plain!.why).toMatch(/falta de agua/);
  });

  it("los riesgos hablan de calor y sequía cuando el cultivo no los aguanta", () => {
    const { plain } = plainOf(["thirsty"], DRY);
    expect(plain!.risks.join(" ")).toMatch(/calor/);
    expect(plain!.risks.join(" ")).toMatch(/llueve poco|se pierde más agua/);
  });

  it("siempre termina los riesgos aclarando que es una guía sencilla", () => {
    expect(plainOf(["cover"], WET).plain!.risks.at(-1)).toMatch(/guía sencilla/);
  });

  it("los beneficios usan las mismas condiciones que los técnicos pero en palabras simples", () => {
    const { plain, benefits } = plainOf(["legume"], WET);
    expect(benefits.some((text) => /nitrógeno/i.test(text))).toBe(true);
    expect(plain!.benefits.join(" ")).toMatch(/abono natural/);
    expect(plain!.benefits).toHaveLength(plainOf(["legume"], WET).benefits.length);
  });

  it("si nada destaca, lo dice sin inventar ventajas", () => {
    const { plain } = plainOf(["thirsty"], WET);
    expect(plain!.benefits.join(" ")).not.toMatch(/abono|protege/);
    expect(plain!.benefits.length).toBeGreaterThan(0);
  });

  it("los vacíos de información son pocos y claros, e incluyen que los datos son de la zona", () => {
    const { plain } = plainOf(["tolerant"], WET);
    expect(plain!.gaps.length).toBeLessThanOrEqual(8);
    expect(plain!.gaps.join(" ")).toMatch(/suelo/);
    expect(plain!.gaps.join(" ")).toMatch(/toda la zona|zona/);
  });

  it("avisa cuando faltaron días de datos del clima", () => {
    const { plain } = plainOf(["tolerant"], { ...WET, missingByParameter: { ...NO_MISSING, T2M: 5 } });
    expect(plain!.gaps.join(" ")).toMatch(/faltaron algunos días/i);
  });

  it("pide validar con un técnico y nombra los cultivos", () => {
    const { plain } = plainOf(["tolerant", "legume"], WET);
    expect(plain!.validate.join(" ")).toMatch(/técnico/);
    expect(plain!.validate.join(" ")).toContain("Cultivo tolerante");
    expect(plain!.validate.join(" ")).toContain("Leguminosa");
  });

  it("no altera los textos técnicos existentes", () => {
    const result = plainOf(["thirsty"], DRY);
    expect(result.whySuggested).toMatch(/^Obtiene \d\.\d\/5/);
    expect(result.evidence.length).toBeGreaterThan(1);
  });
});

describe("meses en el texto simple", () => {
  it("usa nombres completos de los meses, no abreviaturas", () => {
    const text = plainOf(["thirsty"], DRY).plain!.risks.join(" ") + plainOf(["thirsty"], DRY).plain!.gaps.join(" ");
    expect(text).not.toMatch(/\b(ene|feb|abr|ago|sep|dic)\b/);
  });
});
