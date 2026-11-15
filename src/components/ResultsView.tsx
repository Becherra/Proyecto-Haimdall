"use client";

import dynamic from "next/dynamic";
import { Fragment, useMemo, useState } from "react";
import { CropIcon, UiIcon } from "./icons";
import type { UiIconName } from "./icons";
import Logo from "./Logo";
import { useSpeaker } from "./useSpeaker";
import { bestRotationIndex, climateTopicSpeechItems, describeClimate, isCurrentRotation, MAX_STARS, RAIN_CALENDAR_INTRO, rainCalendar, rainCalendarSpeechItems, rotationSections, rotationSpeechItems, scoreToStars } from "../lib/ui/resultsCopy";
import type { ClimateTopicId, RotationSection } from "../lib/ui/resultsCopy";
import type { AnalysisResponse, Farm, RotationResult } from "../types";

const FarmMiniMap = dynamic(() => import("./FarmMiniMap"), { ssr: false, loading: () => <div className="h-full w-full bg-spruce" aria-hidden="true" /> });

type ResultsViewProps = { farm: Farm; response: AnalysisResponse; onEditPriorities: () => void; onChangeFarm: () => void; onShowTechnical: () => void };

const CLIMATE_ICONS: Record<ClimateTopicId, UiIconName> = { water: "drop", heat: "sun", frost: "snow", rain: "rain", temperature: "thermo", roots: "roots" };
const SECTION_ICONS: Record<RotationSection["id"], UiIconName> = { why: "bulb", evidence: "search", benefits: "check", risks: "warning", gaps: "question", expert: "person" };

type PlayProps = { playing: boolean; onClick: () => void; size?: "small" | "big" };
function PlayButton({ playing, onClick, size = "small" }: PlayProps) {
  const dimension = size === "big" ? "h-24 w-full gap-3 text-xl font-bold" : "h-14 w-14 shrink-0";
  return <button type="button" onClick={onClick} aria-label={playing ? "Parar" : "Escuchar"} aria-pressed={playing} className={`flex items-center justify-center rounded-full bg-cream text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50 ${dimension}`}>
    <UiIcon name={playing ? "stop" : "speaker"} className={size === "big" ? "h-12 w-12" : "h-8 w-8"} />
    {size === "big" && <span>{playing ? "Parar" : "Escuchar"}</span>}
  </button>;
}

function Stars({ score, className = "h-7 w-7" }: { score: number; className?: string }) {
  const full = scoreToStars(score);
  return <span className="flex gap-1 text-cream" role="img" aria-label={`${full} de ${MAX_STARS}`}>
    {Array.from({ length: MAX_STARS }, (_, index) => <span key={index} className={index < full ? "" : "opacity-25"}><UiIcon name="star" className={className} /></span>)}
  </span>;
}

function CropChain({ cropIds, className = "h-14 w-14" }: { cropIds: readonly string[]; className?: string }) {
  return <span className="flex items-center gap-1 text-bone-white" aria-hidden="true">
    {cropIds.map((id, index) => <Fragment key={`${id}-${index}`}>{index > 0 && <UiIcon name="arrow" className="h-6 w-6 text-cream/60" />}<CropIcon id={id} className={className} /></Fragment>)}
  </span>;
}

function Badges({ result, best }: { result: RotationResult; best: boolean }) {
  const chip = "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold";
  return <div className="flex flex-wrap gap-2">
    {isCurrentRotation(result) && <span className={`${chip} bg-bone-white/15 text-bone-white`}><UiIcon name="field" className="h-5 w-5" />Hoy</span>}
    {best && <span className={`${chip} bg-cream text-meadow`}><UiIcon name="star" className="h-5 w-5" />Mejor</span>}
  </div>;
}

function RotationCard({ result, best, onOpen }: { result: RotationResult; best: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className={`flex w-full flex-col gap-3 rounded-3xl border-2 bg-spruce p-4 text-left transition hover:border-cream focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50 ${best ? "border-cream" : "border-olive/50"}`}>
    <div className="flex items-start justify-between gap-2"><Badges result={result} best={best} /><UiIcon name="arrow" className="h-7 w-7 shrink-0 text-cream" /></div>
    <CropChain cropIds={result.rotation.cropIds} />
    <p className="text-lg font-bold text-bone-white">{result.rotation.name}</p>
    <Stars score={result.score} />
  </button>;
}

function RotationDetail({ result, best, onClose }: { result: RotationResult; best: boolean; onClose: () => void }) {
  const { playingKey, play, stop } = useSpeaker();
  const key = `rotation-${result.rotation.id}`;
  const close = () => { stop(); onClose(); };
  return <section className="fixed inset-0 z-50 overflow-y-auto bg-meadow" aria-label={result.rotation.name}>
    <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={close} aria-label="Volver" className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><UiIcon name="back" className="h-8 w-8" /></button>
        <Logo variant="mark" size={44} />
      </div>
      <PlayButton size="big" playing={playingKey === key} onClick={() => play(key, rotationSpeechItems(result))} />
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-olive/50 bg-spruce p-4">
        <Badges result={result} best={best} />
        <CropChain cropIds={result.rotation.cropIds} />
        <p className="text-xl font-bold text-bone-white">{result.rotation.name}</p>
        <Stars score={result.score} />
      </div>
      {rotationSections(result).map((section) => <article key={section.id} className="rounded-3xl border border-olive/40 bg-spruce p-4">
        <h3 className="mb-3 flex items-center gap-3 text-xl font-bold text-cream"><UiIcon name={SECTION_ICONS[section.id]} className="h-9 w-9 shrink-0" />{section.title}</h3>
        <ul className="space-y-2 text-lg leading-7 text-bone-white">{section.texts.map((text) => <li key={text}>{text}</li>)}</ul>
      </article>)}
    </div>
  </section>;
}

function RainCalendar({ response }: { response: AnalysisResponse }) {
  const { playingKey, play } = useSpeaker();
  const calendar = useMemo(() => rainCalendar(response.monthlyClimate), [response.monthlyClimate]);
  return <article className="rounded-3xl border border-olive/40 bg-spruce p-4">
    <div className="mb-3 flex items-center gap-3"><UiIcon name="calendar" className="h-10 w-10 shrink-0 text-cream" /><h3 className="flex-1 text-xl font-bold text-bone-white">{RAIN_CALENDAR_INTRO.title}</h3><PlayButton playing={playingKey === "rain-calendar"} onClick={() => play("rain-calendar", rainCalendarSpeechItems(calendar))} /></div>
    <ol className="grid grid-cols-6 gap-x-1 gap-y-3 text-center" aria-label={RAIN_CALENDAR_INTRO.title}>
      {calendar.map((month) => <li key={month.month} className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold uppercase text-silver-mist">{month.label}</span>
        <span className="flex h-12 flex-col items-center justify-end gap-0.5 text-cream" role="img" aria-label={month.level === null ? "Sin dato" : `${month.level} de 3`}>
          {month.level === null ? <span className="text-sm text-ash-gray">—</span> : Array.from({ length: month.level }, (_, index) => <UiIcon key={index} name="dropFilled" className="h-4 w-4" />)}
        </span>
      </li>)}
    </ol>
    <p className="mt-3 text-base leading-6 text-silver-mist">{RAIN_CALENDAR_INTRO.explanation}</p>
  </article>;
}

function ClimateList({ response }: { response: AnalysisResponse }) {
  const { playingKey, play } = useSpeaker();
  const topics = useMemo(() => describeClimate(response.indicators), [response.indicators]);
  return <>{topics.map((topic) => <article key={topic.id} className="rounded-3xl border border-olive/40 bg-spruce p-4">
    <div className="flex items-center gap-3">
      <UiIcon name={CLIMATE_ICONS[topic.id]} className="h-12 w-12 shrink-0 text-cream" />
      <div className="min-w-0 flex-1"><h3 className="text-xl font-bold leading-6 text-bone-white">{topic.simpleTitle}</h3><p className="text-xs uppercase tracking-wider text-ash-gray">{topic.technicalName}</p></div>
      <PlayButton playing={playingKey === topic.id} onClick={() => play(topic.id, climateTopicSpeechItems(topic))} />
    </div>
    <p className="mt-3 text-lg font-semibold leading-7 text-cream">{topic.yourZone}</p>
    <p className="mt-1 text-base leading-6 text-silver-mist">{topic.explanation}</p>
  </article>)}</>;
}

const actionButton = "flex h-16 w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream";

export default function ResultsView({ farm, response, onEditPriorities, onChangeFarm, onShowTechnical }: ResultsViewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const bestIndex = bestRotationIndex(response.rotations);
  const open = openIndex === null ? null : response.rotations[openIndex] ?? null;

  return <main className="fixed inset-0 z-40 overflow-y-auto bg-meadow">
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-12 pt-4">
      <header className="flex items-center justify-between gap-3">
        <Logo variant="horizontal" size={36} />
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-cream/60 shadow-lg" role="img" aria-label={`Mapa de ${farm.placeLabel ?? "tu finca"}`}><FarmMiniMap farm={farm} /></div>
      </header>

      <h2 className="flex items-center gap-3 text-2xl font-bold text-bone-white"><UiIcon name="field" className="h-8 w-8 text-cream" />Tus 3 caminos</h2>
      {response.rotations.map((result, index) => <RotationCard key={result.rotation.id} result={result} best={index === bestIndex} onOpen={() => setOpenIndex(index)} />)}

      <h2 className="mt-4 flex items-center gap-3 text-2xl font-bold text-bone-white"><UiIcon name="sun" className="h-8 w-8 text-cream" />El clima de tu zona</h2>
      <ClimateList response={response} />
      <RainCalendar response={response} />

      <p className="mt-2 rounded-2xl bg-spruce/60 p-4 text-center text-sm leading-6 text-silver-mist">Esto es una ayuda para decidir. No reemplaza tu experiencia ni a un técnico de tu zona. Datos del clima: NASA POWER.</p>
      <nav className="flex items-start justify-center gap-6" aria-label="Más opciones">
        <button type="button" onClick={onEditPriorities} className="flex flex-col items-center gap-1 text-xs text-silver-mist"><span className={actionButton}><UiIcon name="back" className="h-8 w-8" /></span>Preguntas</button>
        <button type="button" onClick={onChangeFarm} className="flex flex-col items-center gap-1 text-xs text-silver-mist"><span className={actionButton}><UiIcon name="pin" className="h-8 w-8" /></span>Otra finca</button>
        <button type="button" onClick={onShowTechnical} className="flex flex-col items-center gap-1 text-xs text-silver-mist"><span className={actionButton}><UiIcon name="sliders" className="h-8 w-8" /></span>Datos técnicos</button>
      </nav>
      <p className="text-center text-[10px] text-ash-gray">Imágenes: © Esri · OpenStreetMap</p>
    </div>
    {open && <RotationDetail result={open} best={openIndex === bestIndex} onClose={() => setOpenIndex(null)} />}
  </main>;
}
