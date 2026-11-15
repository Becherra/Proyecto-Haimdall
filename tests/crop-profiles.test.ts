import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CROP_PROFILES, findCatalogReferenceErrors, getCropProfile, parseCropProfileCatalog, selectionErrors } from "../src/lib/cropProfiles";
import type { CropProfileCatalog } from "../src/types";

const KNOWN = new Set(["cafe", "platano"]);
const raw = (): CropProfileCatalog => JSON.parse(readFileSync("data/crop-profiles.json", "utf8")) as CropProfileCatalog;

describe("catálogo piloto de perfiles", () => {
  it("carga café y plátano como especies separadas, con variedades, etapas y amenazas", () => {
    for (const cropId of ["cafe", "platano"]) {
      const profile = getCropProfile(CROP_PROFILES, cropId);
      expect(profile, cropId).toBeDefined();
      expect(profile?.cultivars.length).toBeGreaterThan(0);
      expect(profile?.growthStages.length).toBeGreaterThan(0);
      expect(profile?.threats.length).toBeGreaterThan(0);
    }
    expect(getCropProfile(CROP_PROFILES, "cafe")?.threats.map((threat) => threat.id)).toEqual(expect.arrayContaining(["roya", "broca"]));
    expect(getCropProfile(CROP_PROFILES, "platano")?.threats.map((threat) => threat.id)).toEqual(expect.arrayContaining(["moko", "sigatoka-negra", "picudos"]));
  });

  it("no tiene referencias rotas", () => {
    expect(findCatalogReferenceErrors(CROP_PROFILES, KNOWN)).toEqual([]);
  });

  it("cada amenaza con medidas oficiales exige confirmación", () => {
    for (const threat of CROP_PROFILES.profiles.flatMap((profile) => profile.threats)) {
      if (threat.regulation.status === "documented") expect(threat.requiresOfficialConfirmation, threat.id).toBe(true);
    }
  });

  it("ninguna medida recomienda productos químicos ni dosis", () => {
    const measures = CROP_PROFILES.profiles.flatMap((profile) => profile.threats.flatMap((threat) => threat.measures));
    for (const measure of measures) {
      const text = `${measure.action} ${measure.condition}`.toLowerCase();
      expect(text, measure.id).not.toMatch(/\b(aplica|asperja|fumiga|inyecta)\b|\d+\s*(ml|cc|%|g\/l|l\/ha)|glifosato|fungicida|herbicida/);
    }
  });

  it("la alerta de moko no se generaliza: su ámbito nombra Urabá", () => {
    const moko = getCropProfile(CROP_PROFILES, "platano")?.threats.find((threat) => threat.id === "moko");
    expect(moko?.geographicScope.statement).toMatch(/Urabá/);
    expect(moko?.geographicScope.context).toMatch(/No asumas/);
  });
});

describe("validación del catálogo", () => {
  it("detecta una cita a una fuente que no existe", () => {
    const catalog = raw();
    catalog.profiles[0].scientificName.sources = [{ sourceId: "fuente-fantasma" }];
    expect(() => parseCropProfileCatalog(catalog, KNOWN)).toThrow(/fuente-fantasma/);
  });

  it("detecta un cultivo sin entrada en crops.json", () => {
    expect(() => parseCropProfileCatalog(raw(), new Set(["cafe"]))).toThrow(/platano: el cultivo no existe/);
  });

  it("detecta etapas y amenazas inexistentes y ids reservados", () => {
    const catalog = raw();
    const cafe = catalog.profiles[0];
    cafe.threats[0].measures[0].stageIds = ["floracion-inventada"];
    cafe.cultivars[0].threatResponses = [{ threatId: "ojo-de-gallo", response: { status: "undocumented", reason: "x" } }];
    cafe.growthStages[0].id = "unknown";
    const errors = findCatalogReferenceErrors(catalog, KNOWN);
    expect(errors.join("\n")).toMatch(/floracion-inventada/);
    expect(errors.join("\n")).toMatch(/ojo-de-gallo/);
    expect(errors.join("\n")).toMatch(/«unknown» está reservado/);
  });

  it("rechaza un catálogo con forma inválida", () => {
    expect(() => parseCropProfileCatalog({ schemaVersion: 2 }, KNOWN)).toThrow();
  });
});

describe("selección del agricultor", () => {
  it("acepta «No sé» y «Otra variedad» en cualquier paso", () => {
    expect(selectionErrors(CROP_PROFILES, { cropId: "platano", cultivarId: "other", otherCultivarName: "África", plantingMaterialId: "unknown", stageId: "unknown", observedThreatId: "unknown" })).toEqual([]);
  });

  it("rechaza ids que no son del cultivo elegido", () => {
    expect(selectionErrors(CROP_PROFILES, { cropId: "platano", cultivarId: "castillo-general", stageId: "produccion", observedThreatId: "roya" })).toHaveLength(3);
    expect(selectionErrors(CROP_PROFILES, { cropId: "maiz", cultivarId: "unknown", stageId: "unknown" })).toHaveLength(1);
  });
});
