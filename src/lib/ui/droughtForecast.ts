import { droughtCategorySchema, droughtForecastSchema, type DroughtCategory, type DroughtForecast } from "../../types/drought";
import type { SpeechItem } from "./resultsCopy";

export { droughtCategorySchema, droughtForecastSchema } from "../../types/drought";
export type { DroughtCategory, DroughtForecast } from "../../types/drought";

const CATEGORY_SEVERITY: Record<DroughtCategory, number> = {
  none: 0, D0: 1, D1: 2, D2: 3, D3: 4, D4: 5,
};

export const DROUGHT_CATEGORY_LABEL: Record<DroughtCategory, string> = {
  none: "Sin señal de sequía",
  D0: "Anormalmente seco",
  D1: "Sequía moderada",
  D2: "Sequía severa",
  D3: "Sequía extrema",
  D4: "Sequía excepcional",
};

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export type DroughtForecastSummary = {
  category: DroughtCategory;
  categoryLabel: string;
  peakMonthsLabel: string;
  headline: string;
  meaning: string;
};

/** Turns the strongest forecast months into a short, careful explanation for farmers. */
export function summarizeDroughtForecast(forecast: DroughtForecast): DroughtForecastSummary {
  const upcoming = forecast.months.filter(({ month }) => month >= forecast.forecastStartMonth);
  const strongest = upcoming.reduce<DroughtCategory>((peak, entry) => CATEGORY_SEVERITY[entry.category] > CATEGORY_SEVERITY[peak] ? entry.category : peak, "none");
  const peakMonths = upcoming.filter(({ category }) => category === strongest).map(({ month }) => month);
  const peakMonthsLabel = formatMonthList(peakMonths);

  return {
    category: strongest,
    categoryLabel: DROUGHT_CATEGORY_LABEL[strongest],
    peakMonthsLabel,
    headline: strongest === "none"
      ? `El IDEAM no muestra señal de sequía para ${forecast.hydrographicZone} en este periodo.`
      : `El IDEAM prevé ${DROUGHT_CATEGORY_LABEL[strongest].toLowerCase()} en la zona hidrográfica ${forecast.hydrographicZone} durante ${peakMonthsLabel}.`,
    meaning: meaningFor(strongest),
  };
}

/** Lo que conviene vigilar: es el mismo texto que se ve en la tarjeta y que se lee en voz alta. */
export const DROUGHT_WATCH_TEXT = "La disponibilidad de agua y la humedad del suelo de tu lote al acercarse esos meses. El efecto en el cultivo depende de cuál tengas y de su etapa.";

/** Etiqueta corta de un mes del pronóstico, en palabras de campo. */
export function simpleDroughtLabel(category: DroughtCategory): string {
  if (category === "none") return "Sin señal seca";
  if (category === "D0") return "Más seco de lo habitual";
  return DROUGHT_CATEGORY_LABEL[category];
}

/** El pronóstico para leer en voz alta: titular, cada mes por venir, qué puede significar y qué vigilar. */
export function droughtForecastSpeechItems(forecast: DroughtForecast): SpeechItem[] {
  const summary = summarizeDroughtForecast(forecast);
  const months = forecast.months.filter(({ month }) => month >= forecast.forecastStartMonth)
    .map(({ month, category }) => `${formatDroughtMonth(month)}: ${simpleDroughtLabel(category).toLowerCase()}.`);
  return [
    { text: `Pronóstico de sequía del IDEAM. ${summary.headline}` },
    { text: months.join(" ") },
    { text: `Qué puede significar: ${summary.meaning} Qué conviene vigilar: ${DROUGHT_WATCH_TEXT}` },
  ];
}

function formatMonthList(months: string[]): string {
  if (months.length === 0) return "el periodo consultado";
  const years = new Set(months.map((month) => month.slice(0, 4)));
  if (years.size === 1) {
    const names = months.map((month) => MONTH_NAMES[Number(month.slice(5)) - 1] ?? month);
    const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
    return `${joined} de ${months[0]?.slice(0, 4) ?? ""}`;
  }
  const labels = months.map(formatMonth);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

export function formatDroughtMonth(value: string): string {
  const [year = "", month = ""] = value.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? month} de ${year}`;
}

function formatMonth(value: string): string {
  return formatDroughtMonth(value);
}

function meaningFor(category: DroughtCategory): string {
  if (category === "none") return "El pronóstico no muestra una señal de sequía para esta zona en los meses consultados.";
  if (category === "D0") return "Es una señal de condiciones más secas de lo habitual; por sí sola no confirma sequía ni daños en el cultivo.";
  return "Una señal seca en la zona puede presionar la humedad del suelo y los caudales. No confirma falta de agua ni daños en tu lote.";
}
