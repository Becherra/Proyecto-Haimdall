import { generateActionPlan } from "../lib/actionPlan";
import { analysisResponseSchema, type AnalysisResponse } from "../types";
import { mockLocation } from "./location";

const mockResponse = {
  climate: {
    source: "sample",
    records: [
      { date: "20200101", T2M: 16.62, T2M_MIN: 14.04, T2M_MAX: 20.56, PRECTOTCORR: 4.24, EVLAND: 2.89, GWETROOT: 0.89, ALLSKY_SFC_SW_DWN: 14.61 },
      { date: "20200102", T2M: 16.74, T2M_MIN: 14.11, T2M_MAX: 21.09, PRECTOTCORR: 4.69, EVLAND: 3.01, GWETROOT: 0.89, ALLSKY_SFC_SW_DWN: 18.33 },
    ],
    missingByParameter: { T2M: 0, T2M_MIN: 0, T2M_MAX: 0, PRECTOTCORR: 0, EVLAND: 0, GWETROOT: 0, ALLSKY_SFC_SW_DWN: 0 },
  },
  monthlyClimate: [{ year: 2020, month: 1, meanTemperatureC: 16.8, precipitationMm: 125.4, evaporationMm: 87.2, rootZoneWetness: 0.82, missingByParameter: {} }],
  indicators: { waterDeficitMm: 38.2, heatStressDays: 0, frostRiskDays: 0, extremeRainThresholdMm: 24.6, meanRootZoneWetness: 0.82, missingByParameter: {}, longestDrySpellDays: 15, meanAnnualDrySpellDays: 9.2, worstYear: { year: 2021, waterBalanceMm: -12.2 } },
  // Temporada reciente de ejemplo (lluvia 111 % de lo normal), igual que una consulta real a NASA POWER en noviembre de 2026.
  currentSeason: { windowDays: 87, firstDate: "20260818", lastDate: "20261112", daysWithData: 87, rainMm: 563.27, normalRainMm: 507.42, rainPercentOfNormal: 111, status: "normal", temperatureAnomalyC: 1.4, currentDryStreakDays: 0, baselineYears: 15 },
  rotations: [
    {
      rotation: { id: "baseline", name: "Actual: maíz–descanso", cropIds: ["maiz"], description: "Mantiene la práctica declarada como línea base de comparación." },
      score: 2.8,
      whySuggested: "Sirve como referencia para medir si las alternativas mejoran el uso del agua y la protección del suelo.",
      evidence: ["NASA POWER registra 38.2 mm de déficit hídrico acumulado en el periodo de muestra.", "La humedad de la zona radicular fue 0.82 en enero de 2020."],
      benefits: ["Mercado y manejo conocidos por el agricultor.", "Permite comparar costos y resultados actuales."],
      informationGaps: ["No conocemos el tipo de suelo ni el precio local del maíz."],
      risks: ["El descanso deja el suelo expuesto a lluvias intensas.", "La dependencia de un solo cultivo concentra el riesgo de mercado."],
      validateWithLocalExpert: ["Confirmar cobertura del suelo durante el descanso.", "Revisar presión de plagas y costos reales de la finca."],
    },
    {
      rotation: { id: "legume", name: "Maíz → fríjol → maíz", cropIds: ["maiz", "frijol"], description: "Intercala una leguminosa para diversificar ingresos y aportar nitrógeno." },
      score: 4.1,
      whySuggested: "La leguminosa puede mejorar el suelo y repartir el riesgo económico sin alejarse de cultivos conocidos en la región.",
      evidence: ["La lluvia y evaporación de la muestra permiten evaluar una ventana con déficit moderado.", "La serie incluye precipitación diaria corregida de NASA POWER."],
      benefits: ["Diversifica ingresos.", "Puede aportar nitrógeno al sistema.", "Reduce el tiempo de suelo desnudo."],
      informationGaps: ["No hay análisis de fertilidad ni datos de compradores de fríjol."],
      risks: ["La competencia por agua puede aumentar en meses secos.", "El calendario puede coincidir con picos de plagas."],
      validateWithLocalExpert: ["Definir variedad y fechas de siembra locales.", "Validar manejo de enfermedades y disponibilidad de semilla."],
    },
    {
      rotation: { id: "cover-drought", name: "Cobertura + cultivo tolerante a sequía", cropIds: ["mucuna", "yuca"], description: "Usa cobertura vegetal y un cultivo de raíz para proteger el suelo." },
      score: 4.4,
      whySuggested: "La cobertura ayuda a reducir erosión y la raíz profunda puede amortiguar periodos con menor disponibilidad de agua.",
      evidence: ["El percentil extremo estimado de lluvia diaria es 24.6 mm, relevante para planificar cobertura.", "GWETROOT se entrega como proxy de humedad, no como medición directa de cada lote."],
      benefits: ["Protege el suelo de la lluvia.", "Mejora potencialmente la materia orgánica.", "Diversifica la producción frente a la variabilidad climática."],
      informationGaps: ["Faltan pendiente, textura del suelo, NDVI y precios de yuca en la zona."],
      risks: ["La cobertura puede competir por agua si se maneja tarde.", "El mercado y ciclo de yuca pueden no ajustarse al flujo de caja."],
      validateWithLocalExpert: ["Elegir especie de cobertura que no se vuelva invasora.", "Ajustar fecha de corte y verificar demanda local de yuca."],
    },
  ],
} satisfies AnalysisResponse;

// El plan sale del generador real para que el mock muestre lo mismo que respondería el backend (maíz: sin pasos y con su vacío).
const withActionPlans = {
  ...mockResponse,
  rotations: mockResponse.rotations.map((result) => ({ ...result, actionPlan: generateActionPlan({ rotation: result.rotation, location: mockLocation, season: mockResponse.currentSeason }) })),
};

export const mockAnalysisResponse: AnalysisResponse = analysisResponseSchema.parse(withActionPlans);
