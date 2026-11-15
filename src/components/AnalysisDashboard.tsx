"use client";

import { Fragment, useMemo } from "react";
import { useReveal } from "./motion";
import { CropIcon, UiIcon } from "./icons";
import type { UiIconName } from "./icons";
import Logo from "./Logo";
import { useSpeaker } from "./useSpeaker";
import { activeScenarioPreset, bestRotationIndex, cropLink, describeNasaSupport, describeSimpleSources, isCurrentRotation, MAX_STARS, scenarioPresets, scoreToStars } from "../lib/ui/resultsCopy";
import type { NasaSupportItemId, ScenarioPresetId } from "../lib/ui/resultsCopy";
import type { AnalysisResponse, ClimateScenario, Farm, RotationResult } from "../types";

type AnalysisDashboardProps = {
  farm: Farm;
  response: AnalysisResponse;
  baseline: AnalysisResponse;
  scenarioDraft: ClimateScenario;
  mockMode: boolean;
  applyingScenario: boolean;
  scenarioError: string | null;
  onSelectScenario?: (scenario: ClimateScenario) => void;
  onScenarioChange: (scenario: ClimateScenario) => void;
  onApplyScenario: () => void;
  onShowBaseline: () => void;
  onEditPriorities: () => void;
  onChangeFarm: () => void;
  /** Vuelve a la vista simple de resultados. */
  onBackToSimple?: () => void;
};

const SUPPORT_ICONS: Record<NasaSupportItemId, UiIconName> = { history: "calendar", drought: "sun", worstYear: "warning", terrain: "field" };
const SCENARIO_ICONS: Record<ScenarioPresetId, UiIconName> = { normal: "check", drought: "sun", wet: "rain", heat: "thermo" };

function PlaySmall({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={playing ? "Parar" : "Escuchar"} aria-pressed={playing} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cream text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50">
    <UiIcon name={playing ? "stop" : "speaker"} className="h-8 w-8" />
  </button>;
}

function Stars({ score }: { score: number }) {
  const full = scoreToStars(score);
  return <span className="flex gap-1 text-cream" role="img" aria-label={`${full} de ${MAX_STARS}`}>
    {Array.from({ length: MAX_STARS }, (_, index) => <span key={index} className={index < full ? "" : "opacity-25"}><UiIcon name="star" className="h-6 w-6" /></span>)}
  </span>;
}

/** Los ids de rotación son "ranuras" (p. ej. "legume"): con otro clima la misma ranura puede traer otro camino, así que también se comparan los cultivos. */
const sameRotation = (a: RotationResult, b: RotationResult) => a.rotation.id === b.rotation.id && a.rotation.cropIds.join(",") === b.rotation.cropIds.join(",");

function changePhrase(current: number, base: number | undefined): { text: string; tone: string } {
  if (base === undefined) return { text: "Este camino aparece con este clima: no estaba entre los 3 con clima normal", tone: "text-cream" };
  const diff = scoreToStars(current) - scoreToStars(base);
  if (diff > 0) return { text: "Con este clima le va mejor que con el normal", tone: "text-olive-light" };
  if (diff < 0) return { text: "Con este clima le va peor que con el normal", tone: "text-clay-light" };
  return { text: "Con este clima le va igual que con el normal", tone: "text-silver-mist" };
}

function VisualRotationCard({ result, base, best, showChange }: { result: RotationResult; base: RotationResult | undefined; best: boolean; showChange: boolean }) {
  const link = cropLink(result.rotation);
  const change = showChange ? changePhrase(result.score, base?.score) : null;
  return <article data-reveal className={`flex flex-col gap-3 rounded-3xl border-2 bg-moss card-surface p-4 ${best ? "border-cream" : "border-olive/40"}`}>
    <div className="flex flex-wrap gap-2">
      {isCurrentRotation(result) && <span className="flex items-center gap-1.5 rounded-full bg-olive px-3 py-1 text-sm font-bold text-bone-white"><UiIcon name="field" className="h-5 w-5" />Hoy</span>}
      {best && <span className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-sm font-bold text-meadow"><UiIcon name="star" className="h-5 w-5" />Mejor</span>}
    </div>
    <span className="flex items-center gap-1 text-olive-light" aria-hidden="true">
      {result.rotation.cropIds.map((id, index) => <Fragment key={`${id}-${index}`}>{index > 0 && <UiIcon name={link === "with" ? "plus" : "arrow"} className="h-6 w-6 text-olive-light/50" />}<CropIcon id={id} className="h-12 w-12" /></Fragment>)}
    </span>
    <h3 className="text-lg font-bold text-bone-white">{result.rotation.name}</h3>
    <Stars score={result.score} />
    <p className="text-base leading-6 text-silver-mist">{result.plain?.why ?? result.whySuggested}</p>
    {change && <p className={`text-sm font-bold ${change.tone}`}>{change.text}</p>}
  </article>;
}

export default function AnalysisDashboard({ farm, response, baseline, mockMode, applyingScenario, scenarioError, onSelectScenario, onScenarioChange, onApplyScenario, onShowBaseline, onBackToSimple }: AnalysisDashboardProps) {
  const { playingKey, play } = useSpeaker();
  const supportItems = useMemo(() => describeNasaSupport(response), [response]);
  const sources = useMemo(() => describeSimpleSources(response.dataSources), [response.dataSources]);
  const presets = scenarioPresets(response.extremeYears);
  const active = activeScenarioPreset(response.scenario, presets);
  const bestIndex = bestRotationIndex(response.rotations);
  const showChange = active.id !== "normal";
  const reveal = useReveal<HTMLElement>();

  function pickPreset(scenario: ClimateScenario) {
    if (onSelectScenario) { onSelectScenario(scenario); return; }
    if ((scenario.tempDeltaC ?? 0) === 0 && (scenario.rainFactor ?? 1) === 1) { onShowBaseline(); return; }
    onScenarioChange(scenario);
    onApplyScenario();
  }

  return <section ref={reveal} className="fixed inset-0 z-40 overflow-y-auto bg-scene" aria-labelledby="support-title">
    <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-4 lg:max-w-5xl lg:px-8 lg:pt-8">
      <header data-reveal className="flex items-center justify-between gap-3">
        {onBackToSimple && <button type="button" onClick={onBackToSimple} aria-label="Volver" className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><UiIcon name="back" className="h-8 w-8" /></button>}
        <div className="min-w-0 flex-1 text-center"><h1 id="support-title" className="text-2xl font-bold text-bone-white">¿Cómo lo sabemos?</h1><p className="truncate text-sm text-silver-mist">{farm.placeLabel ?? "Tu finca"}</p></div>
        <Logo variant="mark" size={44} />
      </header>

      <section data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4" aria-label="¿Y si cambia el tiempo?">
        <div className="flex items-center gap-3">
          <UiIcon name="sun" className="h-10 w-10 shrink-0 text-olive-light" />
          <div><h2 className="text-xl font-bold text-bone-white">¿Y si cambia el tiempo?</h2><p className="text-sm text-silver-mist">Toca un botón para poner a prueba tus 3 caminos.</p></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {presets.map((preset) => {
            const selected = preset.id === active.id;
            return <button key={preset.id} type="button" aria-pressed={selected} disabled={applyingScenario || (mockMode && preset.id !== "normal")} onClick={() => pickPreset(preset.scenario)} className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50 disabled:opacity-40 ${selected ? "border-cream bg-olive/50 text-bone-white" : "border-olive/40 bg-meadow/40 text-silver-mist hover:border-cream/60"}`}>
              <UiIcon name={SCENARIO_ICONS[preset.id]} className={`h-8 w-8 ${selected ? "text-cream" : "text-olive-light"}`} />
              <span className="text-base font-bold leading-5 text-bone-white">{preset.label}</span>
              <span className="text-xs leading-4 text-silver-mist">{preset.subtitle}</span>
            </button>;
          })}
        </div>
        <p className="mt-3 text-sm font-medium text-olive-light" role="status">{applyingScenario ? "Mirando cómo responderían tus cultivos…" : active.notice}</p>
        {scenarioError && <p className="mt-2 text-sm text-clay-light" role="alert">{scenarioError}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {response.rotations.map((result, index) => <VisualRotationCard key={result.rotation.id} result={result} base={baseline.rotations.find((item) => sameRotation(item, result))} best={index === bestIndex} showChange={showChange} />)}
      </div>

      <h2 data-reveal className="mt-2 flex items-center gap-3 text-2xl font-bold text-bone-white"><UiIcon name="calendar" className="h-8 w-8 text-olive-light" />Lo que ha vivido tu zona</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {supportItems.map((item) => <article key={item.id} data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4">
          <div className="flex items-center gap-3">
            <UiIcon name={SUPPORT_ICONS[item.id]} className="h-12 w-12 shrink-0 text-olive-light" />
            <h3 className="flex-1 text-xl font-bold leading-6 text-bone-white">{item.title}</h3>
            <PlaySmall playing={playingKey === `support-${item.id}`} onClick={() => play(`support-${item.id}`, [{ text: `${item.title}. ${item.body}` }])} />
          </div>
          <p className="mt-3 text-base leading-6 text-bone-white">{item.body}</p>
        </article>)}
      </div>

      {sources.length > 0 && <>
        <h2 data-reveal className="mt-2 flex items-center gap-3 text-2xl font-bold text-bone-white"><UiIcon name="search" className="h-8 w-8 text-olive-light" />¿Qué miraron los satélites de la NASA?</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => <article key={source.id} data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4">
            <div className="flex items-center gap-3">
              <UiIcon name="check" className="h-10 w-10 shrink-0 text-olive-light" />
              <h3 className="flex-1 text-lg font-bold text-bone-white">{source.title}</h3>
              <PlaySmall playing={playingKey === `source-${source.id}`} onClick={() => play(`source-${source.id}`, [{ text: `${source.title}. ${source.body}` }])} />
            </div>
            <p className="mt-2 text-base leading-6 text-silver-mist">{source.body}</p>
          </article>)}
        </div>
      </>}

      <p className="mt-2 rounded-2xl bg-moss/60 p-4 text-center text-sm leading-6 text-silver-mist">Esta guía te ayuda a pensar tu siembra, pero tu conocimiento del terreno y el consejo de un técnico de tu zona siempre van primero.</p>
    </div>
  </section>;
}
