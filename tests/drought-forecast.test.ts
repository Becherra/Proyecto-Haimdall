import { describe, expect, it } from "vitest";
import { DROUGHT_WATCH_TEXT, droughtForecastSchema, droughtForecastSpeechItems, simpleDroughtLabel, summarizeDroughtForecast, type DroughtForecast } from "../src/lib/ui/droughtForecast";

const forecast: DroughtForecast = {
  source: "IDEAM",
  sourceUrl: "https://www.ideam.gov.co/",
  issuedAt: "2026-11-07",
  hydrographicZone: "Cauca",
  geographyLevel: "hydrographic-zone",
  aggregationMonths: 3,
  forecastStartMonth: "2026-11",
  months: [
    { month: "2026-11", category: "D0", indexValue: -0.679 },
    { month: "2026-12", category: "D0", indexValue: -0.588 },
    { month: "2027-01", category: "D1", indexValue: -1.082 },
    { month: "2027-02", category: "D3", indexValue: -1.891 },
    { month: "2027-03", category: "D3", indexValue: -1.672 },
    { month: "2027-04", category: "D1", indexValue: -1.216 },
  ],
};

describe("drought forecast speech", () => {
  it("reads the headline, each upcoming month in simple words and what to watch", () => {
    const text = droughtForecastSpeechItems(forecast).map((item) => item.text).join(" ");
    expect(text).toContain("El IDEAM prevé sequía extrema");
    expect(text).toContain("noviembre de 2026: más seco de lo habitual");
    expect(text).toContain("febrero de 2027: sequía extrema");
    expect(text).toContain(DROUGHT_WATCH_TEXT);
  });

  it("skips months before the forecast starts", () => {
    const text = droughtForecastSpeechItems({ ...forecast, forecastStartMonth: "2027-02" }).map((item) => item.text).join(" ");
    expect(text).not.toContain("noviembre de 2026");
    expect(text).toContain("marzo de 2027");
  });

  it("names a month without drought signal plainly", () => {
    expect(simpleDroughtLabel("none")).toBe("Sin señal seca");
    expect(simpleDroughtLabel("D0")).toBe("Más seco de lo habitual");
    expect(simpleDroughtLabel("D2")).toBe("Sequía severa");
  });
});

describe("drought forecast display", () => {
  it("validates IDEAM's zone-level monthly response", () => {
    expect(droughtForecastSchema.safeParse(forecast).success).toBe(true);
    expect(droughtForecastSchema.safeParse({ ...forecast, aggregationMonths: 5 }).success).toBe(false);
    expect(droughtForecastSchema.safeParse({ ...forecast, geographyLevel: "farm" }).success).toBe(false);
  });

  it("summarizes the strongest months without claiming field damage", () => {
    const summary = summarizeDroughtForecast(forecast);
    expect(summary.category).toBe("D3");
    expect(summary.headline).toContain("febrero y marzo de 2027");
    expect(summary.meaning).toContain("No confirma falta de agua ni daños en tu lote");
  });

  it("explains that D0 is a dry signal, not confirmed drought", () => {
    const summary = summarizeDroughtForecast({ ...forecast, months: forecast.months.slice(0, 2) });
    expect(summary.category).toBe("D0");
    expect(summary.meaning).toContain("no confirma sequía ni daños");
  });

  it("does not treat past months as an upcoming warning", () => {
    const historicalOnly = { ...forecast, forecastStartMonth: "2027-01", months: forecast.months.slice(0, 2) };
    expect(summarizeDroughtForecast(historicalOnly).category).toBe("none");
  });
});
