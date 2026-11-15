import { NextResponse } from "next/server";
import { AnalysisInputError, buildAnalysis } from "../../../lib/analysis";
import { resolveAnalysisSite } from "../../../lib/analysisSite";
import { CROPS } from "../../../lib/catalog";
import { fetchDailyClimate, InvalidClimateRequestError } from "../../../lib/nasaPower";
import { analysisRequestSchema } from "../../../types";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "El cuerpo debe ser JSON válido" }, { status: 400 }); }
  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const { priorities, startYear, endYear, scenario, includeDailyRecords } = parsed.data;
  const site = resolveAnalysisSite(parsed.data);
  if (!site.valid) return NextResponse.json({ error: site.errors.join(" ") }, { status: 400 });
  try {
    const climate = await fetchDailyClimate({ ...site.location, startYear, endYear });
    return NextResponse.json(buildAnalysis({ climate, crops: CROPS, priorities, location: site.location, siteGaps: site.informationGaps, scenario, includeDailyRecords }));
  } catch (error) {
    if (error instanceof AnalysisInputError || error instanceof InvalidClimateRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    const message = error instanceof Error ? error.message : "No fue posible completar el análisis";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
