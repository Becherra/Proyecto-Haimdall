import { describe, expect, it } from "vitest";
import { EARTH_METERS_PER_DEGREE, elevationAt, meanElevationAt, parseHgt, slopePercentAt, SRTM_VOID, type HgtTile } from "../src/lib/srtm";

/** Arma un tile sintético de `size`×`size` (fila 0 = borde norte) a partir de una función fila/columna → altura. */
function tileFrom(size: number, height: (row: number, col: number) => number, south = 0, west = -76): HgtTile {
  const heights = new Int16Array(size * size);
  for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) heights[row * size + col] = height(row, col);
  return { south, west, size, heights };
}

function hgtBytes(values: number[]): Uint8Array {
  const view = new DataView(new ArrayBuffer(values.length * 2));
  values.forEach((value, index) => view.setInt16(index * 2, value, false));
  return new Uint8Array(view.buffer);
}

describe("parseHgt", () => {
  it("lee enteros de 16 bits en big-endian, fila 0 al norte, y deduce el tamaño del tile", () => {
    const tile = parseHgt(hgtBytes([1500, -20, 300, 258]), 4, -76);
    expect(tile).toMatchObject({ south: 4, west: -76, size: 2 });
    expect(Array.from(tile.heights)).toEqual([1500, -20, 300, 258]);
  });

  it("rechaza un archivo cuyo tamaño no forma un cuadrado", () => {
    expect(() => parseHgt(hgtBytes([1, 2, 3]), 4, -76)).toThrow(/cuadrada/);
    expect(() => parseHgt(new Uint8Array([1, 2, 3]), 4, -76)).toThrow(/cuadrada/);
  });

  it("rechaza un archivo vacío", () => {
    expect(() => parseHgt(new Uint8Array(), 4, -76)).toThrow();
  });
});

describe("elevationAt", () => {
  const tile = tileFrom(3, (row, col) => 1000 + row * 10 + col * 100); // 3×3: esquina NO = 1000, SE = 1220

  it("devuelve la altura de un nodo de la malla (la fila 0 es el borde norte)", () => {
    expect(elevationAt(tile, 1, -76)).toBe(1000); // lat norte del tile, lon oeste
    expect(elevationAt(tile, 0, -76)).toBe(1020); // borde sur, oeste
    expect(elevationAt(tile, 1, -75)).toBe(1200);
  });

  it("interpola en el centro entre los cuatro nodos vecinos", () => {
    const flatHalf = tileFrom(3, (_row, col) => col * 100);
    expect(elevationAt(flatHalf, 0.75, -75.75)).toBeCloseTo(50, 5);
  });

  it("devuelve null fuera del tile", () => {
    expect(elevationAt(tile, 1.2, -75.5)).toBeNull();
    expect(elevationAt(tile, 0.5, -77)).toBeNull();
    expect(elevationAt(tile, -0.1, -75.5)).toBeNull();
  });

  it("devuelve null si alguno de los nodos vecinos es un vacío de SRTM", () => {
    const withVoid = tileFrom(3, (row, col) => (row === 0 && col === 0 ? SRTM_VOID : 500));
    expect(elevationAt(withVoid, 0.8, -75.8)).toBeNull();
    expect(elevationAt(withVoid, 0.2, -75.2)).toBe(500);
  });
});

describe("meanElevationAt", () => {
  it("promedia las celdas de la ventana alrededor del punto", () => {
    const tile = tileFrom(5, (_row, col) => col * 10);
    expect(meanElevationAt(tile, 0.5, -75.5, 1)).toBeCloseTo(20, 5);
  });

  it("ignora los vacíos y devuelve null si toda la ventana es vacío", () => {
    const mixed = tileFrom(5, (row, col) => (row === 2 && col === 2 ? SRTM_VOID : 100));
    expect(meanElevationAt(mixed, 0.5, -75.5, 1)).toBe(100);
    expect(meanElevationAt(tileFrom(5, () => SRTM_VOID), 0.5, -75.5, 1)).toBeNull();
  });

  it("devuelve null si el punto cae fuera del tile", () => {
    expect(meanElevationAt(tileFrom(5, () => 100), 3, -75.5, 1)).toBeNull();
  });
});

describe("slopePercentAt", () => {
  const SIZE = 9;
  const SPACING_DEG = 1 / (SIZE - 1);
  const lat = 0.5;
  const lon = -75.5;

  it("es 0 en terreno plano", () => {
    expect(slopePercentAt(tileFrom(SIZE, () => 800), lat, lon, 1)).toBeCloseTo(0, 6);
  });

  it("mide la pendiente de un plano inclinado de este a oeste en porcentaje (metros de desnivel por cada 100 m)", () => {
    const tile = tileFrom(SIZE, (_row, col) => col * 100);
    const cellEastWestMeters = SPACING_DEG * EARTH_METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180);
    expect(slopePercentAt(tile, lat, lon, 1)).toBeCloseTo((100 / cellEastWestMeters) * 100, 3);
  });

  it("mide igual un plano inclinado de norte a sur", () => {
    const tile = tileFrom(SIZE, (row) => row * 100);
    const cellNorthSouthMeters = SPACING_DEG * EARTH_METERS_PER_DEGREE;
    expect(slopePercentAt(tile, lat, lon, 1)).toBeCloseTo((100 / cellNorthSouthMeters) * 100, 3);
  });

  it("no cuenta las celdas con vacíos y devuelve null si ninguna es calculable", () => {
    const withVoid = tileFrom(SIZE, (row, col) => (row === 4 && col === 4 ? SRTM_VOID : col * 100));
    expect(slopePercentAt(withVoid, lat, lon, 0)).toBeNull();
    expect(slopePercentAt(withVoid, lat, lon, 2)).not.toBeNull();
  });

  it("devuelve null en el borde del tile, donde no hay vecinos para calcular", () => {
    expect(slopePercentAt(tileFrom(SIZE, (_r, c) => c * 100), 0, -76, 0)).toBeNull();
  });

  it("devuelve null si el punto cae fuera del tile", () => {
    expect(slopePercentAt(tileFrom(SIZE, () => 100), 3, -75.5, 1)).toBeNull();
  });
});
