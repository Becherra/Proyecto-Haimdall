import { describe, expect, it } from "vitest";
import { CURRENT_SEASON_PERCENTILE, MIN_YEARS_FOR_CURRENT_SEASON } from "../src/lib/config";
import { computeCurrentSeason } from "../src/lib/currentSeason";
import type { ClimateRecord } from "../src/types";

const toDate = (time: number) => new Date(time).toISOString().slice(0, 10).replaceAll("-", "");

function days(startIso: string, count: number, make: (index: number) => Partial<ClimateRecord>): ClimateRecord[] {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => ({
    date: toDate(start + index * 86_400_000), T2M: 20, T2M_MIN: 14, T2M_MAX: 27, PRECTOTCORR: 5, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15, ...make(index),
  }));
}

/** Serie histórica: los años dados completos, con la misma lluvia y temperatura todos los días. */
function baseline(years: number[], rain = 5, temperature = 20): ClimateRecord[] {
  return years.flatMap((year) => days(`${year}-01-01`, 366, () => ({ PRECTOTCORR: rain, T2M: temperature })).filter((record) => record.date.startsWith(String(year))));
}
const YEARS = Array.from({ length: MIN_YEARS_FOR_CURRENT_SEASON + 3 }, (_, index) => 2017 + index);
/** Serie histórica con `rains[i]` mm/día en el año `2017 + i`. */
function varied(rains: number[]): ClimateRecord[] {
  return rains.flatMap((rain, index) => baseline([2017 + index], rain));
}
const recentWith = (rain: number, count = 30, start = "2026-10-01") => days(start, count, () => ({ PRECTOTCORR: rain }));

describe("computeCurrentSeason: lluvia reciente frente a lo normal", () => {
  it("compara la lluvia de la ventana con el mismo tramo del calendario de los años anteriores", () => {
    const season = computeCurrentSeason(recentWith(2), baseline(YEARS, 5));
    expect(season).toMatchObject({ windowDays: 30, daysWithData: 30, firstDate: "20261001", lastDate: "20261030", rainMm: 60, normalRainMm: 150, rainPercentOfNormal: 40, status: "much-drier", baselineYears: YEARS.length });
  });

  it("clasifica la temporada por el lugar que ocupa entre los años de la serie, no por un porcentaje fijo", () => {
    // Ocho años con 2 a 9 mm/día en esa época; el estado depende de cuántos años fueron más secos que hoy.
    const history = varied([2, 3, 4, 5, 6, 7, 8, 9]);
    const statusFor = (rainPerDay: number) => computeCurrentSeason(recentWith(rainPerDay), history)?.status;
    expect(statusFor(1)).toBe("much-drier");
    expect(statusFor(2.5)).toBe("drier");
    expect(statusFor(5.5)).toBe("normal");
    expect(statusFor(7.5)).toBe("wetter");
    expect(statusFor(9.5)).toBe("much-wetter");
  });

  it("dice en cuántos años de la serie llovió menos que hoy y el lugar que ocupa (0 a 1)", () => {
    const season = computeCurrentSeason(recentWith(5.5), varied([2, 3, 4, 5, 6, 7, 8, 9]));
    expect(season).toMatchObject({ baselineYears: 8, baselineYearsDrier: 4, rainPercentile: 0.5 });
    expect(computeCurrentSeason(recentWith(1), varied([2, 3, 4, 5, 6, 7, 8, 9]))).toMatchObject({ baselineYearsDrier: 0, rainPercentile: 0 });
    expect(computeCurrentSeason(recentWith(20), varied([2, 3, 4, 5, 6, 7, 8, 9]))).toMatchObject({ baselineYearsDrier: 8, rainPercentile: 1 });
  });

  it("los empates con un año de la serie cuentan la mitad y no son 'más lluvioso que' ese año", () => {
    const season = computeCurrentSeason(recentWith(5), baseline(YEARS, 5));
    expect(season).toMatchObject({ baselineYearsDrier: 0, rainPercentile: 0.5, status: "normal" });
  });

  it("una misma lluvia es normal en un sitio de lluvia muy variable y muy seca en uno de lluvia estable", () => {
    const steady = varied([4.8, 4.9, 5, 5.1, 5.2, 5.3, 5.4, 5.5]);
    const erratic = varied([1, 3, 5, 7, 9, 11, 13, 15]);
    expect(computeCurrentSeason(recentWith(4.5), steady)?.status).toBe("drier");
    expect(computeCurrentSeason(recentWith(8), erratic)?.status).toBe("normal");
  });

  it("'muy seca' o 'muy lluviosa' piden además alejarse al menos un tercio de lo normal, aunque sea la más seca de la serie", () => {
    const steady = varied([4.8, 4.9, 5, 5.1, 5.2, 5.3, 5.4, 5.5]);
    expect(computeCurrentSeason(recentWith(4.5), steady)).toMatchObject({ rainPercentile: 0, status: "drier" }); // -13 %: la más seca, pero no "casi no ha llovido"
    expect(computeCurrentSeason(recentWith(6.2), steady)).toMatchObject({ rainPercentile: 1, status: "wetter" });
    expect(computeCurrentSeason(recentWith(2), steady)?.status).toBe("much-drier"); // -61 %
    expect(computeCurrentSeason(recentWith(9), steady)?.status).toBe("much-wetter"); // +75 %
  });

  it("los cortes del lugar entre los años son crecientes", () => {
    const { muchDrier, drier, wetter, muchWetter } = CURRENT_SEASON_PERCENTILE;
    expect(muchDrier).toBeLessThan(drier);
    expect(drier).toBeLessThan(wetter);
    expect(wetter).toBeLessThan(muchWetter);
  });

  it("ignora los registros de la propia ventana si la serie histórica los trae", () => {
    const history = [...baseline(YEARS, 5), ...days("2026-10-01", 30, () => ({ PRECTOTCORR: 50 }))];
    expect(computeCurrentSeason(recentWith(5), history)).toMatchObject({ rainPercentOfNormal: 100, status: "normal", baselineYears: YEARS.length });
  });

  it("maneja una ventana que cruza de un año al siguiente", () => {
    const season = computeCurrentSeason(recentWith(1, 30, "2025-12-20"), baseline(YEARS, 4));
    expect(season).toMatchObject({ windowDays: 30, normalRainMm: 120, rainMm: 30, rainPercentOfNormal: 25, status: "much-drier", baselineYears: YEARS.length - 1 });
    // La temporada que empieza en diciembre del último año de la serie no tiene su enero: queda fuera por cobertura insuficiente.
  });

  it("calcula la anomalía de temperatura frente a lo normal", () => {
    const recent = days("2026-10-01", 30, () => ({ T2M: 22 }));
    expect(computeCurrentSeason(recent, baseline(YEARS, 5, 20))?.temperatureAnomalyC).toBeCloseTo(2, 5);
  });

  it("cuenta los días secos seguidos hasta el último día con dato", () => {
    const recent = days("2026-10-01", 30, (index) => ({ PRECTOTCORR: index >= 26 ? 0 : 5 }));
    expect(computeCurrentSeason(recent, baseline(YEARS))?.currentDryStreakDays).toBe(4);
  });

  it("termina la ventana en el último día con dato de lluvia, sin contar los días sin dato del final", () => {
    const recent = days("2026-10-01", 33, (index) => ({ PRECTOTCORR: index >= 30 ? null : 5 }));
    expect(computeCurrentSeason(recent, baseline(YEARS))).toMatchObject({ windowDays: 30, lastDate: "20261030", daysWithData: 30 });
  });

  it("escala la lluvia cuando faltan algunos días para no subestimarla", () => {
    const recent = days("2026-10-01", 30, (index) => ({ PRECTOTCORR: index % 10 === 0 ? null : 5 }));
    const season = computeCurrentSeason(recent, baseline(YEARS));
    expect(season?.daysWithData).toBeLessThan(30);
    expect(season?.rainMm).toBeCloseTo(150, 5);
  });

  it("devuelve null sin datos recientes, con muchos faltantes o con una serie histórica corta", () => {
    expect(computeCurrentSeason([], baseline(YEARS))).toBeNull();
    expect(computeCurrentSeason(days("2026-10-01", 30, () => ({ PRECTOTCORR: null })), baseline(YEARS))).toBeNull();
    expect(computeCurrentSeason(days("2026-10-01", 30, (index) => ({ PRECTOTCORR: index < 10 ? 5 : null })), baseline(YEARS))).toBeNull();
    expect(computeCurrentSeason(recentWith(5), baseline(YEARS.slice(0, MIN_YEARS_FOR_CURRENT_SEASON - 1)))).toBeNull();
    expect(computeCurrentSeason(recentWith(5), [])).toBeNull();
  });

  it("si lo normal es 0 mm no inventa un porcentaje", () => {
    const dryBaseline = baseline(YEARS, 0);
    expect(computeCurrentSeason(recentWith(0), dryBaseline)).toMatchObject({ rainPercentOfNormal: null, status: "normal" });
    expect(computeCurrentSeason(recentWith(3), dryBaseline)).toMatchObject({ rainPercentOfNormal: null, status: "much-wetter" });
  });
});
