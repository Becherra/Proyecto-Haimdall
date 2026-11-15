import { describe, expect, it } from "vitest";
import { summarizeMonthlyClimate } from "../src/lib/ui/monthlyClimateSummary";
import type { MonthlyClimate } from "../src/types";

const row = (month: number, precipitationMm: number | null, evaporationMm: number | null, year = 2020): MonthlyClimate => ({
  year, month, meanTemperatureC: 18, precipitationMm, evaporationMm, rootZoneWetness: 0.7, missingByParameter: {},
});

describe("summarizeMonthlyClimate", () => {
  it("averages each calendar month across years and prefers potential evaporation", () => {
    const summary = summarizeMonthlyClimate([
      { ...row(1, 100, 60), potentialEvaporationMm: 80 },
      { ...row(1, 200, 80, 2021), potentialEvaporationMm: 100 },
    ]);
    expect(summary[0]).toMatchObject({ month: 1, precipitationMm: 150, evaporationMm: 90, meanTemperatureC: 18 });
    expect(summary).toHaveLength(12);
  });

  it("ignores missing values and leaves months without data empty", () => {
    const summary = summarizeMonthlyClimate([row(2, null, 30), row(2, 120, null, 2021)]);
    expect(summary[1]).toMatchObject({ precipitationMm: 120, evaporationMm: 30 });
    expect(summary[0]).toMatchObject({ precipitationMm: null, evaporationMm: null });
  });
});
