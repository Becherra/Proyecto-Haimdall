import { describe, expect, it } from "vitest";
import { describeLocalClimateSignal } from "../src/lib/ui/localClimateSignal";
import type { CurrentSeason } from "../src/types";

const season = (status: CurrentSeason["status"], overrides: Partial<CurrentSeason> = {}): CurrentSeason => ({
  windowDays: 90,
  firstDate: "20260815",
  lastDate: "20261112",
  daysWithData: 87,
  rainMm: 420,
  normalRainMm: 500,
  rainPercentOfNormal: 84,
  status,
  temperatureAnomalyC: 1.2,
  currentDryStreakDays: 4,
  baselineYears: 15,
  ...overrides,
});

describe("describeLocalClimateSignal", () => {
  it("maps all observed rainfall statuses to clear Spanish copy", () => {
    expect(["much-drier", "drier", "normal", "wetter", "much-wetter"].map((status) =>
      describeLocalClimateSignal(season(status as CurrentSeason["status"])).label,
    )).toEqual([
      "Lluvia muy por debajo de lo habitual",
      "Lluvia por debajo de lo habitual",
      "Lluvia cercana a lo habitual",
      "Lluvia por encima de lo habitual",
      "Lluvia muy por encima de lo habitual",
    ]);
  });

  it("preserves missing values and the observation cutoff", () => {
    expect(describeLocalClimateSignal(season("normal", { rainPercentOfNormal: null, temperatureAnomalyC: null }))).toMatchObject({
      rainPercent: null,
      temperatureAnomalyC: null,
      observedThrough: "12/11/2026",
    });
  });

  it("explains likely implications and what the farmer can observe for each rainfall state", () => {
    expect(describeLocalClimateSignal(season("normal"))).toMatchObject({
      meaning: expect.stringContaining("no confirma que el suelo"),
      watch: expect.stringContaining("Revisa la humedad"),
    });
    expect(describeLocalClimateSignal(season("much-drier")).watch).toContain("señales de marchitez");
    expect(describeLocalClimateSignal(season("much-wetter")).meaning).toContain("encharcamiento");
  });
});
