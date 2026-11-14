import { describe, expect, it } from "vitest";
import { dayOfYear, extraterrestrialRadiation, hargreavesDailyPet } from "../src/lib/evapotranspiration";

describe("dayOfYear", () => {
  it("cuenta días desde el 1 de enero, con y sin año bisiesto", () => {
    expect(dayOfYear("20230101")).toBe(1);
    expect(dayOfYear("20230903")).toBe(246);
    expect(dayOfYear("20231231")).toBe(365);
    expect(dayOfYear("20240301")).toBe(61);
    expect(dayOfYear("20241231")).toBe(366);
  });
});

describe("extraterrestrialRadiation", () => {
  it("reproduce el ejemplo 8 de FAO-56: 20° S el 3 de septiembre da 32.2 MJ/m²/día", () => {
    expect(extraterrestrialRadiation(-20, dayOfYear("20230903"))).toBeCloseTo(32.2, 0);
  });

  it("en el ecuador varía poco durante el año (menos del 15 %), a diferencia de latitudes medias", () => {
    const spread = (latitude: number) => {
      const radiation = [20230321, 20230621, 20230921, 20231221].map((date) => extraterrestrialRadiation(latitude, dayOfYear(String(date))));
      return (Math.max(...radiation) - Math.min(...radiation)) / Math.max(...radiation);
    };
    expect(spread(0)).toBeLessThan(0.15);
    expect(spread(40)).toBeGreaterThan(0.5);
  });

  it("es mayor en el verano que en el invierno del mismo hemisferio", () => {
    const june = extraterrestrialRadiation(40, dayOfYear("20230621"));
    const december = extraterrestrialRadiation(40, dayOfYear("20231221"));
    expect(june).toBeGreaterThan(december * 2);
  });

  it("no falla en el sol de medianoche ni en la noche polar", () => {
    expect(extraterrestrialRadiation(80, dayOfYear("20230621"))).toBeGreaterThan(30);
    expect(extraterrestrialRadiation(80, dayOfYear("20231221"))).toBe(0);
  });
});

describe("hargreavesDailyPet", () => {
  it("da una evaporación potencial razonable para un día tropical (4–6 mm/día)", () => {
    const ra = extraterrestrialRadiation(4.8, dayOfYear("20230315"));
    const pet = hargreavesDailyPet(24, 18, 30, ra);
    expect(pet).toBeGreaterThan(4);
    expect(pet).toBeLessThan(6);
  });

  it("es cero sin amplitud térmica, porque la fórmula depende de Tmax − Tmin", () => {
    expect(hargreavesDailyPet(20, 20, 20, 35)).toBe(0);
  });

  it("crece con la amplitud térmica y con la radiación", () => {
    expect(hargreavesDailyPet(22, 15, 29, 35)).toBeGreaterThan(hargreavesDailyPet(22, 18, 26, 35));
    expect(hargreavesDailyPet(22, 15, 29, 40)).toBeGreaterThan(hargreavesDailyPet(22, 15, 29, 30));
  });

  it("nunca devuelve valores negativos aunque Tmax < Tmin o haga mucho frío", () => {
    expect(hargreavesDailyPet(20, 25, 15, 35)).toBe(0);
    expect(hargreavesDailyPet(-30, -35, -25, 35)).toBe(0);
  });
});
