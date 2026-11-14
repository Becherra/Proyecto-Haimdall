import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodeLocation } from "../../../lib/geocode";

const querySchema = z.object({ q: z.string().trim().min(2).max(100) });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  const parsed = querySchema.safeParse({ q });
  if (!parsed.success) return NextResponse.json({ error: "La búsqueda debe tener entre 2 y 100 caracteres" }, { status: 400 });
  try {
    const location = await geocodeLocation(parsed.data.q);
    if (!location) return NextResponse.json({ error: "No se encontraron resultados para esa ubicación" }, { status: 404 });
    return NextResponse.json(location);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible geocodificar la ubicación";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
