import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchDroughtForecast, IdeamDroughtError } from "../../../lib/ideamDrought";

const querySchema = z.object({
  lat: z.coerce.number().finite().gte(-90).lte(90),
  lon: z.coerce.number().finite().gte(-180).lte(180),
  aggregation: z.coerce.number().pipe(z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)])).default(3),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos: lat, lon y aggregation deben estar dentro de los rangos permitidos." }, { status: 400 });

  try {
    const forecast = await fetchDroughtForecast({ lat: parsed.data.lat, lon: parsed.data.lon, aggregationMonths: parsed.data.aggregation });
    return NextResponse.json(forecast);
  } catch (error) {
    if (error instanceof IdeamDroughtError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar el pronóstico del IDEAM." }, { status: 502 });
  }
}
