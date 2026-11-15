import type { CurrentSeason } from "../../types";

const STATUS_COPY: Record<CurrentSeason["status"], { label: string; meaning: string; watch: string }> = {
  "much-drier": {
    label: "Lluvia muy por debajo de lo habitual",
    meaning: "Ha llegado mucha menos lluvia que en la misma época de otros años. Puede haber menos agua disponible para el cultivo.",
    watch: "Revisa la humedad del suelo y señales de marchitez; el efecto depende del cultivo, su etapa y si tienes riego.",
  },
  drier: {
    label: "Lluvia por debajo de lo habitual",
    meaning: "La falta de lluvia puede aumentar la presión por agua, especialmente si se prolongan los días secos.",
    watch: "Vigila la humedad del suelo y el estado del cultivo; el riesgo cambia según la etapa y el acceso a riego.",
  },
  normal: {
    label: "Lluvia cercana a lo habitual",
    meaning: "La lluvia acumulada se parece a la de otros años, pero eso no confirma que el suelo de tu finca tenga suficiente humedad.",
    watch: "Revisa la humedad del suelo. Si además hace más calor de lo normal, el cultivo puede perder agua más rápido.",
  },
  wetter: {
    label: "Lluvia por encima de lo habitual",
    meaning: "El exceso de lluvia puede dejar zonas encharcadas o arrastrar suelo, según el drenaje y la pendiente.",
    watch: "Observa charcos, escorrentía y manchas en las hojas; no todos los cultivos ni terrenos responden igual.",
  },
  "much-wetter": {
    label: "Lluvia muy por encima de lo habitual",
    meaning: "La lluvia acumulada elevada puede aumentar el encharcamiento, la erosión y las condiciones favorables para enfermedades.",
    watch: "Revisa drenaje, pérdida de suelo y señales de enfermedad; el riesgo depende del cultivo y las condiciones del lote.",
  },
};

/** Describes the recent local observation without turning it into a forecast or risk score. */
export function describeLocalClimateSignal(season: CurrentSeason) {
  return {
    ...STATUS_COPY[season.status],
    rainPercent: season.rainPercentOfNormal,
    temperatureAnomalyC: season.temperatureAnomalyC,
    dryStreakDays: season.currentDryStreakDays,
    observedThrough: season.lastDate.slice(6, 8) + "/" + season.lastDate.slice(4, 6) + "/" + season.lastDate.slice(0, 4),
  };
}
