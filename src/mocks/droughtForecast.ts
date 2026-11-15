import { droughtForecastSchema } from "../lib/ui/droughtForecast";

/** Consulta real de referencia a la zona hidrográfica Cauca para Pereira; la UI siempre la marca como muestra. */
export const mockDroughtForecast = droughtForecastSchema.parse({
  source: "IDEAM",
  sourceUrl: "https://ideam.gov.co/sites/default/files/prensa/boletines/2026-11-06/10_boletin_hidrologico_mensual_octubre.pdf",
  issuedAt: "2026-11-07",
  hydrographicZone: "Cauca",
  geographyLevel: "hydrographic-zone",
  aggregationMonths: 3,
  forecastStartMonth: "2026-11",
  months: [
    { month: "2026-11", category: "D0", indexValue: -0.67907262 },
    { month: "2026-12", category: "D0", indexValue: -0.58786661 },
    { month: "2027-01", category: "D1", indexValue: -1.08209224 },
    { month: "2027-02", category: "D3", indexValue: -1.89107117 },
    { month: "2027-03", category: "D3", indexValue: -1.6724736 },
    { month: "2027-04", category: "D1", indexValue: -1.215647 },
  ],
});
