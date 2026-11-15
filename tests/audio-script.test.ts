import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLIMATE_EXPLANATIONS, describeClimate, rainCalendarSpeechItems, rotationSpeechItems } from "../src/lib/ui/resultsCopy";
import type { Indicators, RotationResult } from "../src/types";

const script = readFileSync("docs/guion-de-audio.md", "utf8");
const indicators: Indicators = { waterDeficitMm: 1, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 10, meanRootZoneWetness: 0.5, missingByParameter: {} };
const result: RotationResult = { rotation: { id: "x", name: "x", cropIds: ["maiz"], description: "d" }, score: 3, whySuggested: "a", evidence: ["b"], benefits: ["c"], informationGaps: ["d"], risks: ["e"], validateWithLocalExpert: ["f"] };

/** El guion de grabación debe seguir al código: cada frase fija con audioId aparece con su texto exacto. */
describe("guion de audio", () => {
  const fixedItems = [
    ...rotationSpeechItems(result),
    ...describeClimate(indicators).flatMap((topic) => [{ text: `${topic.simpleTitle} ${topic.explanation}`, audioId: topic.explanationAudioId }]),
    ...rainCalendarSpeechItems([]),
  ].filter((item) => item.audioId);

  it("incluye cada id y su texto exacto", () => {
    expect(fixedItems.length).toBeGreaterThan(10);
    for (const item of fixedItems) {
      expect(script, `falta ${item.audioId}`).toContain(`\`${item.audioId}\` | ${item.text} |`);
    }
  });
  it("cubre todos los indicadores del catálogo", () => {
    for (const id of Object.keys(CLIMATE_EXPLANATIONS)) expect(script).toContain(`\`clima-${id}\``);
  });
});
