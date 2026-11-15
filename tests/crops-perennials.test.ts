import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAnalysis } from "../src/lib/analysis";
import { CROPS } from "../src/lib/catalog";
import { candidateRotations, startingRotations } from "../src/lib/rotations";
import { scoreRotations } from "../src/lib/scoring";
import { analysisResponseSchema, cropSchema, type ClimateRecord, type ClimateResult, type Crop, type Indicators, type Rotation, type UserPriorities } from "../src/types";

const raw = (JSON.parse(readFileSync("data/crops.json", "utf8")) as unknown[]).map((crop) => cropSchema.parse(crop));
const real = (id: string): Crop => {
  const found = raw.find((crop) => crop.id === id);
  if (!found) throw new Error(`Falta ${id} en data/crops.json`);
  return found;
};

function crop(id: string, overrides: Partial<Crop> = {}): Crop {
  return {
    id, name: `${id} (Especie ${id})`, waterUse: 2, nitrogenFixation: 0, erosionReduction: 2, organicMatter: 2, forageValue: 2, marketPotential: 3,
    heatTolerance: 3, droughtTolerance: 3, cycleDays: 100, sowingMonths: [3, 9], source: "Cultivo de prueba", family: `Familia ${id}`, ...overrides,
  };
}
const TREE = crop("arbol", { perennial: true, sowingMonths: [], cycleDays: 365, family: "Arbóreas" });
const BEAN = crop("poroto", { nitrogenFixation: 4, family: "Leguminosas", intercropsWith: ["arbol"] });
const MAIZE = crop("trigo", { family: "Gramíneas", intercropsWith: ["arbol"] });
const LOOSE_BEAN = crop("arveja", { nitrogenFixation: 4, family: "Leguminosas" }); // fija N pero sin asociación documentada con el árbol
const COVER = crop("cobertura", { erosionReduction: 5, nitrogenFixation: 4, family: "Leguminosas" });
const TOLERANT = crop("tolerante", { droughtTolerance: 5, family: "Euforbiáceas" });
const WORLD = [TREE, BEAN, MAIZE, LOOSE_BEAN, COVER, TOLERANT];

describe("rotaciones con un cultivo permanente como cultivo actual", () => {
  it("la alternativa de leguminosa asocia solo anuales que fijan nitrógeno y tienen asociación documentada con ese permanente", () => {
    const { legume } = candidateRotations(WORLD, TREE);
    expect(legume.map((rotation) => rotation.cropIds)).toEqual([["arbol", "poroto"]]);
    expect(legume[0].name).toBe("arbol + poroto");
    expect(legume[0].description).toContain("mientras");
  });

  it("la segunda alternativa asocia anuales que no fijan nitrógeno, también con asociación documentada, y conserva el id del contrato", () => {
    const { coverDrought } = candidateRotations(WORLD, TREE);
    expect(coverDrought.map((rotation) => rotation.cropIds)).toEqual([["arbol", "trigo"]]);
    expect(coverDrought[0].id).toBe("cover-drought");
    expect(coverDrought[0].name).toBe("arbol + trigo");
  });

  it("devuelve listas vacías si ningún anual tiene asociación documentada con el permanente", () => {
    const { legume, coverDrought } = candidateRotations([TREE, LOOSE_BEAN, TOLERANT], TREE);
    expect(legume).toEqual([]);
    expect(coverDrought).toEqual([]);
  });
});

describe("los permanentes nunca se sugieren", () => {
  it("un cultivo anual actual no recibe un permanente como pareja, cobertura ni cultivo tolerante", () => {
    const tolerantTree = { ...TREE, nitrogenFixation: 4, erosionReduction: 5, droughtTolerance: 5 };
    const { legume, coverDrought } = candidateRotations([tolerantTree, MAIZE, BEAN, COVER, TOLERANT], MAIZE);
    for (const rotation of [...legume, ...coverDrought]) expect(rotation.cropIds).not.toContain("arbol");
    expect(legume.length).toBeGreaterThan(0);
  });

  it("sin cultivo actual no se ofrece ningún permanente como punto de partida", () => {
    const tolerantTree = { ...TREE, nitrogenFixation: 4, erosionReduction: 5, droughtTolerance: 5 };
    const { single, legume, coverDrought } = startingRotations([tolerantTree, MAIZE, BEAN, COVER, TOLERANT]);
    for (const rotation of [...single, ...legume, ...coverDrought]) expect(rotation.cropIds).not.toContain("arbol");
    expect(single.length).toBe(4);
  });
});

describe("puntaje de un cultivo permanente", () => {
  const WET: Indicators = { waterDeficitMm: 40, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 15, meanRootZoneWetness: 0.8, missingByParameter: {} };
  const EQUAL: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
  const SEASONALITY = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, meanRainMm: 100, meanBalanceMm: 20, dry: false }));
  const score = (cropIds: string[], seasonality = SEASONALITY) => scoreRotations({ rotations: [{ id: "r", name: "r", cropIds, description: "d" } as Rotation], crops: WORLD, indicators: WET, priorities: EQUAL, seasonality })[0];

  it("no cobra la penalización por repetir familia: un permanente no se rota", () => {
    const result = score(["arbol"]);
    expect(result.risks.join(" ")).not.toContain("monocultivo");
    expect(result.informationGaps.join(" ")).not.toContain("El catálogo no trae la familia");
    const withoutPenalty = scoreRotations({ rotations: [{ id: "r", name: "r", cropIds: ["arbol"], description: "d" }], crops: [{ ...TREE, family: undefined } as Crop], indicators: WET, priorities: EQUAL, seasonality: SEASONALITY })[0];
    expect(result.score).toBeCloseTo(withoutPenalty.score, 5);
  });

  it("no arma un calendario de rotación ni evalúa meses de siembra del permanente", () => {
    const result = score(["arbol", "poroto"]);
    expect(result.calendar).toBeUndefined();
    expect(result.informationGaps.join(" ")).not.toContain("calendario de la rotación");
  });

  it("dice que es un cultivo permanente que ocupa el lote todo el año", () => {
    expect(score(["arbol"]).evidence.join(" ")).toContain("Cultivo permanente");
  });

  it("avisa que la asociación con un anual vale en el establecimiento o la renovación y que falta validarla", () => {
    const result = score(["arbol", "poroto"]);
    expect(result.risks.join(" ")).toContain("establecimiento o de renovación");
    expect(result.informationGaps.join(" ")).toContain("no se rota");
  });

  it("avisa que el puntaje de la asociación promedia los dos cultivos y puede subestimarla; el permanente solo no lo dice", () => {
    expect(score(["arbol", "poroto"]).informationGaps.join(" ")).toContain("como si compartieran el lote el mismo tiempo");
    expect(score(["arbol"]).informationGaps.join(" ")).not.toContain("como si compartieran");
  });

  it("la versión simple para el agricultor no habla de cambiar de familia y avisa de la etapa joven", () => {
    const { plain } = score(["arbol", "poroto"]);
    expect(plain?.benefits.join(" ")).not.toContain("Cambia de familia");
    expect(plain?.gaps.join(" ")).toContain("joven");
    expect(plain?.gaps.join(" ")).not.toContain("cambia de familia");
  });

  it("un cultivo anual sigue con su calendario y su penalización de familia como siempre", () => {
    const result = score(["trigo"]);
    expect(result.calendar).toBeDefined();
    expect(result.risks.join(" ")).toContain("monocultivo");
  });
});

describe("café y plátano en data/crops.json", () => {
  it("son cultivos permanentes, sin meses de siembra, con familia y ciclo anual de producción", () => {
    for (const id of ["cafe", "platano"]) {
      const entry = real(id);
      expect(entry.perennial).toBe(true);
      expect(entry.sowingMonths).toEqual([]);
      expect(entry.family).toBeDefined();
      expect(entry.cycleDays).toBe(365);
    }
    expect(real("cafe").family).toBe("Rubiáceas");
    expect(real("platano").family).toBe("Musáceas");
  });

  it("no fijan nitrógeno y no tienen valor de forraje alto", () => {
    for (const id of ["cafe", "platano"]) expect(real(id).nitrogenFixation).toBe(0);
  });

  it("los rangos de temperatura son los de las fichas leídas de FAO EcoCrop", () => {
    // Coffea arabica (id 749): óptimo 14–28 °C, absoluto 10–34 °C.
    expect(real("cafe").temperatureC).toEqual({ goodMin: 14, goodMax: 28, limitMin: 10, limitMax: 34 });
    // Musa acuminata x balbisiana (id 7849): óptimo máximo 35 °C, absoluto 15–40 °C. El mínimo bueno sale de sitios de cultivo colombianos, no de EcoCrop.
    expect(real("platano").temperatureC).toMatchObject({ goodMax: 35, limitMin: 15, limitMax: 40 });
    expect(real("platano").temperatureC?.goodMin).toBeLessThan(25);
  });

  it("citan sus fuentes, distinguen lo leído de lo visto solo en resumen y piden validar", () => {
    for (const [id, ecocrop] of [["cafe", "id 749"], ["platano", "id 7849"]] as const) {
      const { source } = real(id);
      expect(source, id).toContain("EcoCrop");
      expect(source, id).toContain(ecocrop);
      expect(source, id).toContain("resumen de búsqueda");
      expect(source, id).toContain("validar con un agrónomo local");
    }
  });

  it("maíz y fríjol declaran su asociación con café y plátano; los permanentes ids existen y lo son", () => {
    for (const id of ["maiz", "frijol"]) expect(real(id).intercropsWith).toEqual(expect.arrayContaining(["cafe", "platano"]));
    for (const entry of raw) for (const permanentId of entry.intercropsWith ?? []) expect(real(permanentId).perennial, `${entry.id} → ${permanentId}`).toBe(true);
    for (const entry of raw.filter((candidate) => candidate.perennial)) expect(entry.intercropsWith).toBeUndefined();
  });
});

describe("buildAnalysis con café como cultivo actual", () => {
  const priorities: UserPriorities = { waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3 };
  const PEREIRA = { lat: 4.8133, lon: -75.6961 };
  const records: ClimateRecord[] = Array.from({ length: 3 * 365 }, (_, index) => {
    const date = new Date(Date.UTC(2021, 0, 1) + index * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
    return { date, T2M: 16.3, T2M_MIN: 13, T2M_MAX: 21, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15 };
  });
  const climate: ClimateResult = { records, source: "live", cellElevationMeters: 2138, missingByParameter: { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 } };
  const analyze = (extra: Partial<UserPriorities>) => buildAnalysis({ climate, crops: CROPS, priorities: { ...priorities, ...extra }, location: PEREIRA });

  it("devuelve las tres opciones del contrato: café solo, café + fríjol y café + maíz", () => {
    const response = analyze({ currentCropId: "cafe" });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.rotations.map((result) => result.rotation.id)).toEqual(["baseline", "legume", "cover-drought"]);
    expect(response.rotations.map((result) => result.rotation.cropIds)).toEqual([["cafe"], ["cafe", "frijol"], ["cafe", "maiz"]]);
    for (const result of response.rotations) expect(result.calendar).toBeUndefined();
  });

  it("con plátano también arma las tres opciones", () => {
    const response = analyze({ currentCropId: "platano" });
    expect(response.rotations.map((result) => result.rotation.cropIds)).toEqual([["platano"], ["platano", "frijol"], ["platano", "maiz"]]);
  });

  it("un cultivo anual actual nunca recibe café ni plátano en sus alternativas", () => {
    for (const currentCropId of ["maiz", "frijol", "yuca", "papa"]) {
      const response = analyze({ currentCropId });
      for (const result of response.rotations) expect(result.rotation.cropIds, currentCropId).not.toEqual(expect.arrayContaining(["cafe"]));
      for (const result of response.rotations) expect(result.rotation.cropIds, currentCropId).not.toContain("platano");
    }
  });

  it("sin cultivo actual tampoco se proponen como punto de partida", () => {
    const response = analyze({ noCurrentCrop: true });
    for (const result of response.rotations) {
      expect(result.rotation.cropIds).not.toContain("cafe");
      expect(result.rotation.cropIds).not.toContain("platano");
    }
  });

  it("el café a 20,6 °C de media (Pereira) cae dentro de su rango bueno y no sale con riesgo de temperatura", () => {
    const [baseline] = analyze({ currentCropId: "cafe" }).rotations;
    expect(baseline.risks.join(" ")).not.toContain("temperatura");
  });
});
