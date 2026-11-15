import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestLocations } from "../../../../lib/suggest";

const querySchema = z.object({ q: z.string().trim().min(3).max(100) });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({ q: new URL(request.url).searchParams.get("q") });
  if (!parsed.success) return NextResponse.json({ error: "La búsqueda debe tener entre 3 y 100 caracteres" }, { status: 400 });
  try {
    return NextResponse.json({ results: await suggestLocations(parsed.data.q) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible obtener sugerencias";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
