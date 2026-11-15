"use client";

import { useState } from "react";
import AnalysisDashboard from "./AnalysisDashboard";
import PrioritiesForm from "./PrioritiesForm";
import { buildAnalysisRequest, isAnalysisMockMode, runAnalysis } from "../services/analysis";
import type { AnalysisResponse, ClimateScenario, Farm, UserPriorities } from "../types";

const initialPriorities: UserPriorities = {
  waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3,
  currentCropId: "maiz", waterAvailability: "medium",
};
const neutralScenario: ClimateScenario = { tempDeltaC: 0, rainFactor: 1 };

type AnalysisFlowProps = { farm: Farm; onChangeFarm: () => void };

export default function AnalysisFlow({ farm, onChangeFarm }: AnalysisFlowProps) {
  const [step, setStep] = useState<"priorities" | "results">("priorities");
  const [priorities, setPriorities] = useState(initialPriorities);
  const [baseResponse, setBaseResponse] = useState<AnalysisResponse | null>(null);
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [scenarioDraft, setScenarioDraft] = useState<ClimateScenario>(neutralScenario);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockMode = isAnalysisMockMode();

  async function analyzePriorities(nextPriorities: UserPriorities) {
    setPending(true);
    setError(null);
    setPriorities(nextPriorities);
    try {
      const result = await runAnalysis(buildAnalysisRequest(farm, nextPriorities));
      setBaseResponse(result);
      setResponse(result);
      setScenarioDraft(neutralScenario);
      setStep("results");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar la finca. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function applyScenario() {
    if (!baseResponse || mockMode) return;
    setPending(true);
    setError(null);
    try {
      const result = await runAnalysis(buildAnalysisRequest(farm, priorities, scenarioDraft));
      setResponse(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo calcular el escenario.");
    } finally {
      setPending(false);
    }
  }

  function showBaseline() {
    if (!baseResponse) return;
    setResponse(baseResponse);
    setScenarioDraft(neutralScenario);
    setError(null);
  }

  if (step === "priorities" || !response || !baseResponse) {
    return <>
      <PrioritiesForm farm={farm} initialValues={priorities} error={error} submitting={pending} onSubmit={analyzePriorities} onChangeFarm={onChangeFarm} />
      <p className="mx-auto -mt-5 mb-8 max-w-5xl px-4 text-center text-[11px] text-ash-gray sm:px-8">Periodo climático de referencia: 2020–2022. Los escenarios se prueban después y no son pronósticos.</p>
    </>;
  }

  return <AnalysisDashboard
    farm={farm}
    response={response}
    baseline={baseResponse}
    scenarioDraft={scenarioDraft}
    mockMode={mockMode}
    applyingScenario={pending}
    scenarioError={error}
    onScenarioChange={setScenarioDraft}
    onApplyScenario={applyScenario}
    onShowBaseline={showBaseline}
    onEditPriorities={() => { setStep("priorities"); setError(null); }}
    onChangeFarm={onChangeFarm}
  />;
}
