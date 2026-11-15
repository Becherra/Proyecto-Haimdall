import type { Crop, RotationCalendar, RotationCalendarMonth } from "../types";
import { CALENDAR_DAYS_PER_MONTH, HIGH_ATTRIBUTE_THRESHOLD } from "./config";
import { commonName } from "./rotations";
import { formatMonths, type MonthSeason } from "./seasonality";

const MONTHS_IN_YEAR = 12;
const monthAt = (startMonth: number, offset: number) => ((startMonth - 1 + offset) % MONTHS_IN_YEAR) + 1;

/** null si el mes no tiene dato de lluvia: no se puede decir si es seco. */
function isDry(seasonality: readonly MonthSeason[], month: number): boolean | null {
  const season = seasonality.find((entry) => entry.month === month);
  return !season || season.meanRainMm === null ? null : season.dry;
}

function monthRisk(crop: Crop | null, dry: boolean | null): RotationCalendarMonth["risk"] {
  if (dry === null) return null;
  if (crop === null) return dry ? null : "bare-soil-rain";
  return dry && crop.droughtTolerance < HIGH_ATTRIBUTE_THRESHOLD ? "water-stress" : null;
}

/** Ocupación del lote mes a mes: cada cultivo espera (campo vacío) hasta un mes de siembra y luego ocupa su ciclo. */
function occupancy(crops: readonly Crop[], startMonth: number): Array<Crop | null> {
  const slots: Array<Crop | null> = [];
  const waitFor = (crop: Crop) => { while (!crop.sowingMonths.includes(monthAt(startMonth, slots.length))) slots.push(null); };
  for (const crop of crops) {
    waitFor(crop);
    for (let month = 0; month < Math.ceil(crop.cycleDays / CALENDAR_DAYS_PER_MONTH); month += 1) slots.push(crop);
  }
  // El ciclo se cierra cuando el primer cultivo se puede volver a sembrar.
  waitFor(crops[0]);
  return slots;
}

/**
 * Arma el calendario ilustrativo de un ciclo completo de la rotación a partir de los meses de siembra y ciclos del catálogo,
 * y marca los meses vulnerables: campo vacío en mes lluvioso (suelo descubierto) y cultivo poco tolerante a sequía en mes seco.
 * Devuelve null si no hay cultivos o alguno no tiene meses de siembra válidos (no se puede ubicar en el año).
 */
export function buildRotationCalendar(crops: readonly Crop[], seasonality: readonly MonthSeason[]): RotationCalendar | null {
  const sowable = (crop: Crop) => crop.sowingMonths.some((month) => Number.isInteger(month) && month >= 1 && month <= MONTHS_IN_YEAR);
  if (crops.length === 0 || !crops.every(sowable)) return null;
  const startMonth = Math.min(...crops[0].sowingMonths.filter((month) => month >= 1 && month <= MONTHS_IN_YEAR));
  const months = occupancy(crops, startMonth).map((crop, offset): RotationCalendarMonth => {
    const month = monthAt(startMonth, offset);
    const dry = isDry(seasonality, month);
    return { offset, month, cropId: crop?.id ?? null, dry, risk: monthRisk(crop, dry) };
  });
  return { months, fallowMonths: months.filter(({ cropId }) => cropId === null).length, vulnerableMonths: months.filter(({ risk }) => risk !== null).length };
}

const uniqueMonths = (months: readonly RotationCalendarMonth[]) => [...new Set(months.map(({ month }) => month))];

/** Resumen del calendario como evidencia: cuántos meses del ciclo queda vacío el campo y cuáles. */
export function calendarEvidence({ months, fallowMonths }: RotationCalendar): string[] {
  const fallow = uniqueMonths(months.filter(({ cropId }) => cropId === null));
  const detail = fallowMonths === 0 ? "el campo no queda vacío en ningún mes" : `el campo queda vacío ${fallowMonths} de ${months.length} meses (${formatMonths(fallow)})`;
  return [`Calendario estimado de la rotación: ${detail} (meses de siembra y ciclos del catálogo; estacionalidad de lluvia de NASA POWER).`];
}

/** Riesgos de los meses vulnerables: suelo descubierto en época de lluvia y cultivos poco tolerantes a sequía en época seca. */
export function calendarRisks({ months }: RotationCalendar, crops: readonly Crop[]): string[] {
  const bare = uniqueMonths(months.filter(({ risk }) => risk === "bare-soil-rain"));
  const risks = bare.length > 0 ? [`Campo sin cobertura en meses lluviosos (${formatMonths(bare)}): la lluvia cae sobre suelo descubierto y aumenta el riesgo de erosión.`] : [];
  for (const crop of new Set(crops)) {
    const stressed = uniqueMonths(months.filter(({ risk, cropId }) => risk === "water-stress" && cropId === crop.id));
    if (stressed.length > 0) risks.push(`${commonName(crop)} estaría en campo durante meses secos del sitio (${formatMonths(stressed)}): riesgo de estrés hídrico.`);
  }
  return risks;
}

/** El calendario no usa fechas reales del lote: hay que decirlo siempre que se muestre. */
export function calendarGap(): string {
  return "El calendario de la rotación es ilustrativo: usa los meses de siembra y los ciclos típicos del catálogo, no las fechas reales del agricultor.";
}
