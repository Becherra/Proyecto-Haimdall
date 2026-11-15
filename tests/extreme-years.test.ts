import { describe, expect, it } from "vitest";
import { computeExtremeYears } from "../src/lib/extremeYears";
import { climateScenarioSchema, type ClimateRecord } from "../src/types";

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Un año completo con la misma lluvia y temperatura todos los días: `rain` (mm en el año), `temperature` (°C medios) y, opcional, qué fracción de días sin lluvia dato. */
function year(y: number, rain: number, temperature: number, missingRainShare = 0): ClimateRecord[] {
  const length = isLeap(y) ? 366 : 365;
  const start = Date.UTC(y, 0, 1);
  return Array.from({ length }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10).replaceAll("-", ""),
    T2M: temperature, T2M_MIN: temperature - 4, T2M_MAX: temperature + 5,
    PRECTOTCORR: index < length * missingRainShare ? null : rain / length, EVLAND: 3, GWETROOT: 0.8, ALLSKY_SFC_SW_DWN: 15,
  }));
}
const series = (rows: Array<[number, number]>, firstYear = 2011) => rows.flatMap(([rain, temperature], index) => year(firstYear + index, rain, temperature));

describe("computeExtremeYears", () => {
  const rows: Array<[number, number]> = [[1000, 20], [2000, 20], [2000, 20], [2000, 20.5], [2000, 20], [3000, 21]]; // 2011 seco, 2016 lluvioso y cálido

  it("encuentra el año más seco, el más lluvioso y el más cálido, con su cambio frente al promedio", () => {
    const result = computeExtremeYears(series(rows));
    expect(result?.yearsCompared).toBe(6);
    expect(result?.driest).toMatchObject({ year: 2011, rainFactor: 0.5, rainChangePercent: -50 });
    expect(result?.wettest).toMatchObject({ year: 2016, rainFactor: 1.5, rainChangePercent: 50 });
    expect(result?.warmest.year).toBe(2016);
  });

  it("la temperatura de cada año es su diferencia con el promedio de los años comparados", () => {
    const result = computeExtremeYears(series(rows));
    const meanTemperature = (20 + 20 + 20 + 20.5 + 20 + 21) / 6;
    expect(result?.warmest.tempDeltaC).toBeCloseTo(Math.round((21 - meanTemperature) * 10) / 10, 5);
    expect(result?.driest.tempDeltaC).toBeCloseTo(Math.round((20 - meanTemperature) * 10) / 10, 5);
  });

  it("cada año extremo trae también su propia lluvia: el más cálido repite lo que llovió ese año", () => {
    const result = computeExtremeYears(series(rows));
    expect(result?.warmest.rainFactor).toBe(1.5);
  });

  it("acota los factores a los límites de un escenario, pero conserva el cambio real para mostrarlo", () => {
    const result = computeExtremeYears(series([[500, 20], [2000, 20], [2000, 20], [2000, 20], [2000, 20], [2000, 20]]));
    expect(result?.driest.rainFactor).toBe(0.5);
    expect(result?.driest.rainChangePercent).toBe(-71);
  });

  it("todo año extremo es un escenario válido para el motor", () => {
    const result = computeExtremeYears(series([[400, 15], [2000, 20], [2000, 20], [2000, 20], [2000, 20], [4000, 30]]))!;
    for (const extreme of [result.driest, result.wettest, result.warmest]) {
      expect(climateScenarioSchema.safeParse({ tempDeltaC: extreme.tempDeltaC, rainFactor: extreme.rainFactor }).success).toBe(true);
    }
  });

  it("devuelve null con menos de 5 años completos: con tan pocos no hay un año extremo que valga", () => {
    expect(computeExtremeYears(series(rows.slice(0, 4)))).toBeNull();
    expect(computeExtremeYears([])).toBeNull();
  });

  it("deja fuera los años a los que les falta más de una quinta parte de la lluvia", () => {
    const withGap = [...year(2011, 1000, 20, 0.5), ...series(rows.slice(1), 2012)];
    expect(computeExtremeYears(withGap)?.yearsCompared).toBe(5);
    expect(computeExtremeYears(withGap)?.driest.year).not.toBe(2011);
    const onlyFive = [...year(2011, 1000, 20, 0.5), ...series(rows.slice(1, 5), 2012)];
    expect(computeExtremeYears(onlyFive)).toBeNull();
  });

  it("escala la lluvia de un año al que le faltan pocos días para no subestimarlo", () => {
    const result = computeExtremeYears([...year(2011, 2000, 20, 0.1), ...series(rows.slice(1, 6).map(([, t]): [number, number] => [2000, t]), 2012)]);
    expect(result?.driest.rainChangePercent).toBeGreaterThan(-1);
    expect(result?.wettest.rainChangePercent).toBeLessThan(1);
  });
});
