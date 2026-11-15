/** Metros por grado de latitud (radio medio de la Tierra × π/180); para la longitud se multiplica por cos(latitud). Constante física, no un umbral. */
export const EARTH_METERS_PER_DEGREE = 111_195;

/** Valor que SRTM usa para "sin dato" (huecos sobre agua o sombras de radar). */
export const SRTM_VOID = -32768;

/**
 * Un tile SRTM en formato .hgt: malla cuadrada de alturas en metros. La fila 0 es el borde norte y la columna 0 el borde oeste;
 * `south` y `west` son la esquina suroeste en grados (el tile N04W076 tiene south = 4 y west = -76) y la malla cubre 1° × 1°.
 */
export type HgtTile = { south: number; west: number; size: number; heights: Int16Array };

/** Lee un archivo .hgt (enteros de 16 bits con signo, big-endian) y deduce el tamaño de la malla. Lanza error si no es cuadrada. */
export function parseHgt(bytes: Uint8Array, south: number, west: number): HgtTile {
  const count = bytes.byteLength / 2;
  const size = Math.sqrt(count);
  if (count === 0 || !Number.isInteger(count) || !Number.isInteger(size) || size < 2) {
    throw new Error(`El archivo .hgt no forma una malla cuadrada (${bytes.byteLength} bytes)`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const heights = new Int16Array(count);
  for (let index = 0; index < count; index += 1) heights[index] = view.getInt16(index * 2, false);
  return { south, west, size, heights };
}

type GridPosition = { row: number; col: number };

/** Posición fraccionaria (fila, columna) de un punto en la malla; null si cae fuera del tile. */
function gridPosition(tile: HgtTile, lat: number, lon: number): GridPosition | null {
  const row = (tile.south + 1 - lat) * (tile.size - 1);
  const col = (lon - tile.west) * (tile.size - 1);
  const last = tile.size - 1;
  return row < 0 || row > last || col < 0 || col > last ? null : { row, col };
}

function heightAt(tile: HgtTile, row: number, col: number): number | null {
  if (row < 0 || col < 0 || row >= tile.size || col >= tile.size) return null;
  const value = tile.heights[row * tile.size + col];
  return value === SRTM_VOID ? null : value;
}

/** Altitud (m) en un punto por interpolación bilineal; null fuera del tile o si algún nodo vecino es un vacío. */
export function elevationAt(tile: HgtTile, lat: number, lon: number): number | null {
  const position = gridPosition(tile, lat, lon);
  if (!position) return null;
  const row0 = Math.floor(position.row);
  const col0 = Math.floor(position.col);
  const rowFraction = position.row - row0;
  const colFraction = position.col - col0;
  const row1 = rowFraction === 0 ? row0 : row0 + 1;
  const col1 = colFraction === 0 ? col0 : col0 + 1;
  const corners = [heightAt(tile, row0, col0), heightAt(tile, row0, col1), heightAt(tile, row1, col0), heightAt(tile, row1, col1)];
  if (corners.some((corner) => corner === null)) return null;
  const [northWest, northEast, southWest, southEast] = corners as number[];
  const north = northWest + (northEast - northWest) * colFraction;
  const south = southWest + (southEast - southWest) * colFraction;
  return north + (south - north) * rowFraction;
}

/** Celdas dentro de la ventana de `radiusCells` alrededor de la celda más cercana al punto; null si el punto cae fuera del tile. */
function windowCells(tile: HgtTile, lat: number, lon: number, radiusCells: number): GridPosition[] | null {
  const position = gridPosition(tile, lat, lon);
  if (!position) return null;
  const centerRow = Math.round(position.row);
  const centerCol = Math.round(position.col);
  const cells: GridPosition[] = [];
  for (let row = centerRow - radiusCells; row <= centerRow + radiusCells; row += 1) {
    for (let col = centerCol - radiusCells; col <= centerCol + radiusCells; col += 1) cells.push({ row, col });
  }
  return cells;
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Altitud media (m) de las celdas de la ventana alrededor del punto, sin contar vacíos; null si no queda ninguna celda con dato. */
export function meanElevationAt(tile: HgtTile, lat: number, lon: number, radiusCells: number): number | null {
  const cells = windowCells(tile, lat, lon, radiusCells);
  if (!cells) return null;
  return average(cells.flatMap(({ row, col }) => { const value = heightAt(tile, row, col); return value === null ? [] : [value]; }));
}

/**
 * Pendiente de Horn (%, metros de desnivel por cada 100 m) de una ventana 3×3 de alturas (fila 0 al norte, columna 0 al oeste);
 * null si algún valor de la ventana es un vacío. Sirve igual para un tile .hgt que para una malla de alturas consultada a un servicio.
 */
export function hornSlopeFromWindow(window: ReadonlyArray<ReadonlyArray<number | null>>, cellEastWestMeters: number, cellNorthSouthMeters: number): number | null {
  if (window.some((line) => line.some((value) => value === null))) return null;
  const [[a, b, c], [d, , f], [g, h, i]] = window as number[][];
  const gradientEast = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellEastWestMeters);
  const gradientSouth = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cellNorthSouthMeters);
  return 100 * Math.hypot(gradientEast, gradientSouth);
}

/** Pendiente de Horn en una celda del tile; null si falta algún vecino o hay un vacío en sus 3×3. */
function hornSlopePercent(tile: HgtTile, row: number, col: number, cellEastWestMeters: number, cellNorthSouthMeters: number): number | null {
  const around = [-1, 0, 1].map((dr) => [-1, 0, 1].map((dc) => heightAt(tile, row + dr, col + dc)));
  return hornSlopeFromWindow(around, cellEastWestMeters, cellNorthSouthMeters);
}

/**
 * Pendiente media (%) de las celdas de la ventana alrededor del punto, con el método de Horn en cada una y sin contar
 * las celdas del borde del tile ni las que tocan un vacío. Null si no queda ninguna calculable o el punto cae fuera del tile.
 */
export function slopePercentAt(tile: HgtTile, lat: number, lon: number, radiusCells: number): number | null {
  const cells = windowCells(tile, lat, lon, radiusCells);
  if (!cells) return null;
  const spacingDegrees = 1 / (tile.size - 1);
  const cellNorthSouthMeters = spacingDegrees * EARTH_METERS_PER_DEGREE;
  const cellEastWestMeters = cellNorthSouthMeters * Math.cos((lat * Math.PI) / 180);
  return average(cells.flatMap(({ row, col }) => {
    const slope = hornSlopePercent(tile, row, col, cellEastWestMeters, cellNorthSouthMeters);
    return slope === null ? [] : [slope];
  }));
}
