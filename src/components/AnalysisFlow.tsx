"use client";

import { useState } from "react";
import AnalysisDashboard from "./AnalysisDashboard";
import PrioritiesSlides from "./PrioritiesSlides";
import ResultsView from "./ResultsView";
import { buildAnalysisRequest, isAnalysisMockMode, runAnalysis } from "../services/analysis";
import type { ProfileStep } from "../lib/ui/cropProfileFlow";
import type { AnalysisResponse, ClimateScenario, CropProfileSelection, Farm, UserPriorities } from "../types";

const initialPriorities: UserPriorities = {
  waterSaving: 3, extraIncome: 3, soilImprovement: 3, erosionReduction: 3, lowRisk: 3,
};
const neutralScenario: ClimateScenario = { tempDeltaC: 0, rainFactor: 1 };

type AnalysisFlowProps = { farm: Farm; onChangeFarm: () => void };

export default function AnalysisFlow({ farm, onChangeFarm }: AnalysisFlowProps) {
  const [step, setStep] = useState<"priorities" | "results">("priorities");
  const [startStep, setStartStep] = useState<ProfileStep | undefined>(undefined);
  const [technical, setTechnical] = useState(false);
  const [priorities, setPriorities] = useState(initialPriorities);
  const [cropProfile, setCropProfile] = useState<CropProfileSelection | undefined>(undefined);
  const [baseResponse, setBaseResponse] = useState<AnalysisResponse | null>(null);
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [scenarioDraft, setScenarioDraft] = useState<ClimateScenario>(neutralScenario);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mockMode = isAnalysisMockMode();

  async function analyzePriorities(nextPriorities: UserPriorities, nextProfile?: CropProfileSelection) {
    setPending(true);
    setError(null);
    setPriorities(nextPriorities);
    setCropProfile(nextProfile);
    try {
      const result = await runAnalysis(buildAnalysisRequest(farm, nextPriorities, { cropProfile: nextProfile }));
      setBaseResponse(result);
      setResponse(result);
      setScenarioDraft(neutralScenario);
      setTechnical(false);
      setStep("results");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar la finca. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function selectScenario(nextScenario: ClimateScenario) {
    if (!baseResponse) return;
    if ((nextScenario.tempDeltaC ?? 0) === 0 && (nextScenario.rainFactor ?? 1) === 1) {
      showBaseline();
      return;
    }
    if (mockMode) return;
    setPending(true);
    setError(null);
    setScenarioDraft(nextScenario);
    try {
      const result = await runAnalysis(buildAnalysisRequest(farm, priorities, { scenario: nextScenario, cropProfile }));
      setResponse(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo calcular ese clima.");
    } finally {
      setPending(false);
    }
  }

  async function applyScenario() {
    await selectScenario(scenarioDraft);
  }

  function showBaseline() {
    if (!baseResponse) return;
    setResponse(baseResponse);
    setScenarioDraft(neutralScenario);
    setError(null);
  }

  const editAnswers = (focus?: ProfileStep) => { setStartStep(focus); setStep("priorities"); setError(null); };

  if (step === "priorities" || !response || !baseResponse) {
    return <PrioritiesSlides farm={farm} initialValues={priorities} initialProfile={cropProfile} startStep={startStep} error={error} submitting={pending} onSubmit={analyzePriorities} onChangeFarm={onChangeFarm} />;
  }

  if (!technical) return <ResultsView farm={farm} response={response} baseline={baseResponse} cropProfile={cropProfile} applyingScenario={pending} scenarioError={error} mockMode={mockMode} onSelectScenario={selectScenario} onEditPriorities={() => editAnswers()} onTellStage={() => editAnswers("stage")} onChangeFarm={onChangeFarm} onShowTechnical={() => setTechnical(true)} />;

  return <AnalysisDashboard
    onBackToSimple={() => setTechnical(false)}
    farm={farm}
    response={response}
    baseline={baseResponse}
    scenarioDraft={scenarioDraft}
    mockMode={mockMode}
    applyingScenario={pending}
    scenarioError={error}
    onSelectScenario={selectScenario}
    onScenarioChange={setScenarioDraft}
    onApplyScenario={applyScenario}
    onShowBaseline={showBaseline}
    onEditPriorities={() => editAnswers()}
    onChangeFarm={onChangeFarm}
  />;
}
