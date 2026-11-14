import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchDailyClimate, InvalidClimateRequestError } from "../../../lib/nasaPower";

const querySchema = z.object({
  lat: z.coerce.number().finite().gte(-90).lte(90), lon: z.coerce.number().finite().gte(-180).lte(180),
  startYear: z.coerce.number().int().gte(1900).lte(2100), endYear: z.coerce.number().int().gte(1900).lte(2100),
}).refine((value) => value.startYear <= value.endYear, "startYear debe ser menor o igual que endYear");

export async function GET(request: Request) {
  const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  try { return NextResponse.json(await fetchDailyClimate(parsed.data)); }
  catch (error) {
    if (error instanceof InvalidClimateRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    const message = error instanceof Error ? error.message : "No fue posible obtener el clima";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
