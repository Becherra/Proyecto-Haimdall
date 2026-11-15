"use client";

import dynamic from "next/dynamic";
import { Fragment, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion, useReveal } from "./motion";
import { CropIcon, UiIcon } from "./icons";
import type { UiIconName } from "./icons";
import Logo from "./Logo";
import { useSpeaker } from "./useSpeaker";
import { activeScenarioPreset, bestRotationIndex, climateTopicSpeechItems, cropLink, currentSeasonSpeechItems, describeClimate, describeCurrentSeason, isCurrentRotation, MAX_SEASON_DROPS, MAX_STARS, RAIN_CALENDAR_INTRO, rainCalendar, rainCalendarSpeechItems, rotationSections, rotationSpeechItems, scenarioPresets, scoreToStars } from "../lib/ui/resultsCopy";
import type { ClimateTopicId, CurrentSeasonTone, RotationSection, ScenarioPresetId } from "../lib/ui/resultsCopy";
import type { AnalysisResponse, ClimateScenario, CurrentSeason, Farm, RotationResult } from "../types";

const FarmMiniMap = dynamic(() => import("./FarmMiniMap"), { ssr: false, loading: () => <div className="h-full w-full bg-moss" aria-hidden="true" /> });

type ResultsViewProps = {
  farm: Farm;
  response: AnalysisResponse;
  applyingScenario?: boolean;
  scenarioError?: string | null;
  mockMode?: boolean;
  onSelectScenario?: (scenario: ClimateScenario) => void;
  onEditPriorities: () => void;
  onChangeFarm: () => void;
  onShowTechnical: () => void;
};

const CLIMATE_ICONS: Record<ClimateTopicId, UiIconName> = { water: "drop", heat: "sun", frost: "snow", rain: "rain", temperature: "thermo", roots: "roots" };
const SCENARIO_ICONS: Record<ScenarioPresetId, UiIconName> = { normal: "check", drought: "sun", wet: "rain", heat: "thermo" };
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
  const stars = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(".star-on", { scale: 0, rotation: -40, duration: 0.55, ease: "back.out(2.6)", stagger: 0.11, delay: 0.35, clearProps: "transform" });
  }, { scope: stars });
  return <span ref={stars} className="flex gap-1 text-cream" role="img" aria-label={`${full} de ${MAX_STARS}`}>
    {Array.from({ length: MAX_STARS }, (_, index) => <span key={index} className={index < full ? "star-on" : "opacity-25"}><UiIcon name="star" className={className} /></span>)}
  </span>;
}

function CropChain({ cropIds, link = "then", className = "h-14 w-14" }: { cropIds: readonly string[]; link?: "then" | "with"; className?: string }) {
  return <span className="flex items-center gap-1 text-olive-light" aria-hidden="true">
    {cropIds.map((id, index) => <Fragment key={`${id}-${index}`}>{index > 0 && <UiIcon name={link === "with" ? "plus" : "arrow"} className="h-6 w-6 text-olive-light/50" />}<CropIcon id={id} className={className} /></Fragment>)}
  </span>;
}

function Badges({ result, best }: { result: RotationResult; best: boolean }) {
  const chip = "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold";
  return <div className="flex flex-wrap gap-2">
    {isCurrentRotation(result) && <span className={`${chip} bg-olive text-bone-white`}><UiIcon name="field" className="h-5 w-5" />Hoy</span>}
    {best && <span className={`${chip} bg-cream text-meadow`}><UiIcon name="star" className="h-5 w-5" />Mejor</span>}
  </div>;
}

function RotationCard({ result, best, onOpen }: { result: RotationResult; best: boolean; onOpen: () => void }) {
  return <button type="button" data-reveal onClick={onOpen} className={`flex w-full flex-col gap-3 rounded-3xl border-2 bg-moss card-surface p-4 text-left transition-colors hover:border-cream focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50 ${best ? "border-cream" : "border-olive/50"}`}>
    <div className="flex items-start justify-between gap-2"><Badges result={result} best={best} /><UiIcon name="arrow" className="h-7 w-7 shrink-0 text-cream" /></div>
    <CropChain cropIds={result.rotation.cropIds} link={cropLink(result.rotation)} />
    <p className="text-lg font-bold text-bone-white">{result.rotation.name}</p>
    <Stars score={result.score} />
  </button>;
}

/** Cuerpo del acordeón: se despliega con altura animada y los textos entran en cascada. */
function AccordionBody({ texts }: { texts: readonly string[] }) {
  const body = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(body.current, { height: 0, opacity: 0, duration: 0.4, ease: "power2.out", clearProps: "height,opacity" });
    gsap.from(body.current?.querySelectorAll("li") ?? [], { opacity: 0, x: -14, duration: 0.45, stagger: 0.08, delay: 0.1, ease: "power2.out", clearProps: "opacity,transform" });
  }, { scope: body });
  return <div ref={body} className="overflow-hidden"><ul className="space-y-2 px-4 pb-4 text-lg leading-7 text-bone-white">{texts.map((text) => <li key={text}>{text}</li>)}</ul></div>;
}

function RotationDetail({ result, best, onClose }: { result: RotationResult; best: boolean; onClose: () => void }) {
  const { playingKey, play, stop } = useSpeaker();
  const [openId, setOpenId] = useState<RotationSection["id"] | null>(null);
  const key = `rotation-${result.rotation.id}`;
  const close = () => { stop(); onClose(); };
  const reveal = useReveal<HTMLElement>();
  return <section ref={reveal} className="fixed inset-0 z-50 overflow-y-auto bg-scene" aria-label={result.rotation.name}>
    <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-4 lg:max-w-3xl lg:pt-8">
      {/* Columnas iguales a ambos lados para que el logo quede centrado y no flote un ícono suelto en la esquina. */}
      <div className="grid grid-cols-[4rem_1fr_4rem] items-center">
        <button type="button" onClick={close} aria-label="Volver" className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream"><UiIcon name="back" className="h-8 w-8" /></button>
        <Logo variant="horizontal" size={36} className="justify-self-center" />
      </div>
      <div data-reveal><PlayButton size="big" playing={playingKey === key} onClick={() => play(key, rotationSpeechItems(result))} /></div>
      <div data-reveal className="flex flex-col gap-3 rounded-3xl border-2 border-olive/50 bg-moss card-surface p-4">
        <Badges result={result} best={best} />
        <CropChain cropIds={result.rotation.cropIds} link={cropLink(result.rotation)} />
        <p className="text-xl font-bold text-bone-white">{result.rotation.name}</p>
        <Stars score={result.score} />
      </div>
      <div className="flex flex-col gap-3">
        {rotationSections(result).map((section) => {
          const isOpen = openId === section.id;
          return <article key={section.id} data-reveal className={`rounded-3xl border bg-moss card-surface transition-colors ${isOpen ? "border-cream" : "border-olive/40"}`}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : section.id)} className="flex min-h-20 w-full items-center gap-4 rounded-3xl px-4 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50">
              <UiIcon name={SECTION_ICONS[section.id]} className="h-10 w-10 shrink-0 text-olive-light" />
              <span className="flex-1 text-xl font-bold text-bone-white">{section.title}</span>
              <UiIcon name={isOpen ? "up" : "down"} className="h-7 w-7 shrink-0 text-cream" />
            </button>
            {isOpen && <AccordionBody texts={section.texts} />}
          </article>;
        })}
      </div>
    </div>
  </section>;
}

function RainCalendar({ response }: { response: AnalysisResponse }) {
  const { playingKey, play } = useSpeaker();
  const calendar = useMemo(() => rainCalendar(response.monthlyClimate), [response.monthlyClimate]);
  return <article data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4 lg:col-span-3">
    <div className="mb-3 flex items-center gap-3"><UiIcon name="calendar" className="h-10 w-10 shrink-0 text-olive-light" /><h3 className="flex-1 text-xl font-bold text-bone-white">{RAIN_CALENDAR_INTRO.title}</h3><PlayButton playing={playingKey === "rain-calendar"} onClick={() => play("rain-calendar", rainCalendarSpeechItems(calendar))} /></div>
    <ol className="grid grid-cols-6 gap-x-1 gap-y-3 text-center lg:grid-cols-12" aria-label={RAIN_CALENDAR_INTRO.title}>
      {calendar.map((month) => <li key={month.month} className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold uppercase text-silver-mist">{month.label}</span>
        <span className="flex h-12 flex-col items-center justify-end gap-0.5 text-olive-light" role="img" aria-label={month.level === null ? "Sin dato" : `${month.level} de 3`}>
          {month.level === null ? <span className="text-sm text-ash-gray">—</span> : Array.from({ length: month.level }, (_, index) => <UiIcon key={index} name="dropFilled" className="h-4 w-4" />)}
        </span>
      </li>)}
    </ol>
    <p className="mt-3 text-base leading-6 text-silver-mist">{RAIN_CALENDAR_INTRO.explanation}</p>
  </article>;
}

const SEASON_TONE: Record<CurrentSeasonTone, { chip: string; drops: string }> = {
  dry: { chip: "bg-clay/40 text-clay-light", drops: "text-clay-light" },
  normal: { chip: "bg-olive/40 text-olive-light", drops: "text-olive-light" },
  wet: { chip: "bg-cream/15 text-cream", drops: "text-cream" },
};

/** Cómo va la lluvia reciente frente a lo normal de la misma época: gotas de agua comparativas y frases de campo. */
function SeasonCard({ season }: { season: CurrentSeason }) {
  const { playingKey, play } = useSpeaker();
  const card = useMemo(() => describeCurrentSeason(season), [season]);
  const tone = SEASON_TONE[card.tone];
  const article = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(".season-drop-on", { scale: 0, duration: 0.45, ease: "back.out(2.2)", stagger: 0.07, delay: 0.25, clearProps: "transform" });
  }, { scope: article, dependencies: [card.normalDrops, card.currentDrops] });
  const rows = [["Lo normal", card.normalDrops, "text-silver-mist"], ["Este año", card.currentDrops, tone.drops]] as const;
  return <article ref={article} data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4 lg:col-span-3">
    <div className="flex items-center gap-3">
      <UiIcon name="rain" className="h-12 w-12 shrink-0 text-olive-light" />
      <div className="min-w-0 flex-1"><h3 className="text-xl font-bold leading-6 text-bone-white">{card.title}</h3><p className="text-xs uppercase tracking-wider text-ash-gray">{card.technicalName}</p></div>
      <PlayButton playing={playingKey === "season"} onClick={() => play("season", currentSeasonSpeechItems(card))} />
    </div>
    <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-base font-bold ${tone.chip}`}>{card.statusLabel}</p>
    <p className="mt-2 text-lg font-semibold leading-7 text-olive-light">{card.headline}</p>
    <ul className="mt-3 space-y-2" aria-label="Gotas de lluvia normal y de este año">
      {rows.map(([label, drops, color]) => <li key={label} className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-sm font-semibold text-silver-mist">{label}</span>
        <span className={`flex gap-1.5 ${color}`} role="img" aria-label={`${drops} de ${MAX_SEASON_DROPS} gotas`}>
          {Array.from({ length: MAX_SEASON_DROPS }, (_, index) => <span key={index} className={index < drops ? "season-drop-on" : "opacity-20"}><UiIcon name="dropFilled" className="h-6 w-6" /></span>)}
        </span>
      </li>)}
    </ul>
    {card.details.map((detail, index) => <p key={detail} className={`${index === 0 ? "mt-3" : "mt-1"} text-base leading-6 text-bone-white`}>{detail}</p>)}
    <p className="mt-2 text-sm leading-5 text-ash-gray">{card.note}</p>
    <p className="mt-2 text-base leading-6 text-silver-mist">{card.explanation}</p>
  </article>;
}

function ClimateList({ response }: { response: AnalysisResponse }) {
  const { playingKey, play } = useSpeaker();
  const topics = useMemo(() => describeClimate(response.indicators), [response.indicators]);
  return <>{topics.map((topic) => <article key={topic.id} data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4">
    <div className="flex items-center gap-3">
      <UiIcon name={CLIMATE_ICONS[topic.id]} className="h-12 w-12 shrink-0 text-olive-light" />
      <div className="min-w-0 flex-1"><h3 className="text-xl font-bold leading-6 text-bone-white">{topic.simpleTitle}</h3><p className="text-xs uppercase tracking-wider text-ash-gray">{topic.technicalName}</p></div>
      <PlayButton playing={playingKey === topic.id} onClick={() => play(topic.id, climateTopicSpeechItems(topic))} />
    </div>
    <p className="mt-3 text-lg font-semibold leading-7 text-olive-light">{topic.yourZone}</p>
    <p className="mt-1 text-base leading-6 text-silver-mist">{topic.explanation}</p>
  </article>)}</>;
}

function ScenarioBar({ response, applyingScenario, scenarioError, mockMode, onSelectScenario }: Pick<ResultsViewProps, "response" | "applyingScenario" | "scenarioError" | "mockMode" | "onSelectScenario">) {
  if (!onSelectScenario) return null;
  const presets = scenarioPresets(response.extremeYears);
  const active = activeScenarioPreset(response.scenario, presets);
  return <section data-reveal className="rounded-3xl border border-olive/40 bg-moss card-surface p-4 lg:col-span-3" aria-label="¿Y si cambia el tiempo?">
    <div className="flex items-center gap-3">
      <UiIcon name="sun" className="h-10 w-10 shrink-0 text-olive-light" />
      <div><h3 className="text-xl font-bold text-bone-white">¿Y si cambia el tiempo?</h3><p className="text-sm text-silver-mist">Toca un botón para ver cómo aguantan tus 3 caminos.</p></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {presets.map((preset) => {
        const selected = preset.id === active.id;
        return <button key={preset.id} type="button" aria-pressed={selected} disabled={applyingScenario || (mockMode && preset.id !== "normal")} onClick={() => onSelectScenario(preset.scenario)} className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-cream/50 disabled:opacity-40 ${selected ? "border-cream bg-olive/50 text-bone-white" : "border-olive/40 bg-meadow/40 text-silver-mist hover:border-cream/60"}`}>
          <UiIcon name={SCENARIO_ICONS[preset.id]} className={`h-8 w-8 ${selected ? "text-cream" : "text-olive-light"}`} />
          <span className="text-base font-bold leading-5 text-bone-white">{preset.label}</span>
          <span className="text-xs leading-4 text-silver-mist">{preset.subtitle}</span>
        </button>;
      })}
    </div>
    <p className="mt-3 text-sm font-medium text-olive-light" role="status">{applyingScenario ? "Mirando cómo responderían tus cultivos…" : active.notice}</p>
    {scenarioError && <p className="mt-2 text-sm text-clay-light" role="alert">{scenarioError}</p>}
  </section>;
}

const actionButton = "flex h-16 w-16 items-center justify-center rounded-full border-2 border-cream/50 text-bone-white transition hover:border-cream focus:outline-none focus:ring-2 focus:ring-cream";

export default function ResultsView({ farm, response, applyingScenario, scenarioError, mockMode, onSelectScenario, onEditPriorities, onChangeFarm, onShowTechnical }: ResultsViewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const bestIndex = bestRotationIndex(response.rotations);
  const open = openIndex === null ? null : response.rotations[openIndex] ?? null;

  const reveal = useReveal<HTMLElement>();
  return <main ref={reveal} className="fixed inset-0 z-40 overflow-y-auto bg-scene">
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-12 pt-4 lg:grid lg:max-w-6xl lg:grid-cols-3 lg:gap-5 lg:px-8 lg:pt-8">
      <header data-reveal className="flex items-center justify-between gap-3 lg:col-span-3">
        <Logo variant="horizontal" size={36} />
        <div className="relative isolate z-0 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-cream/60 shadow-lg" role="img" aria-label={`Mapa de ${farm.placeLabel ?? "tu finca"}`}><FarmMiniMap farm={farm} /></div>
      </header>

      <h2 data-reveal className="flex items-center gap-3 text-2xl lg:col-span-3 font-bold text-bone-white"><UiIcon name="field" className="h-8 w-8 text-olive-light" />Tus 3 caminos</h2>
      {response.rotations.map((result, index) => <RotationCard key={result.rotation.id} result={result} best={index === bestIndex} onOpen={() => setOpenIndex(index)} />)}
      <ScenarioBar response={response} applyingScenario={applyingScenario} scenarioError={scenarioError} mockMode={mockMode} onSelectScenario={onSelectScenario} />

      <h2 data-reveal className="mt-4 flex items-center gap-3 text-2xl lg:col-span-3 font-bold text-bone-white"><UiIcon name="sun" className="h-8 w-8 text-olive-light" />El clima de tu zona</h2>
      {response.currentSeason && <SeasonCard season={response.currentSeason} />}
      <ClimateList response={response} />
      <RainCalendar response={response} />

      <p className="mt-2 rounded-2xl bg-moss/60 p-4 text-center text-sm leading-6 text-silver-mist lg:col-span-3">Esto es una ayuda para decidir. No reemplaza tu experiencia ni a un técnico de tu zona. Datos del clima: NASA POWER.</p>
      <nav className="flex items-start justify-center gap-6 lg:col-span-3" aria-label="Más opciones">
        <button type="button" onClick={onEditPriorities} className="flex flex-col items-center gap-1 text-xs text-silver-mist"><span className={actionButton}><UiIcon name="back" className="h-8 w-8" /></span>Preguntas</button>
        <button type="button" onClick={onChangeFarm} className="flex flex-col items-center gap-1 text-xs text-silver-mist"><span className={actionButton}><UiIcon name="pin" className="h-8 w-8" /></span>Otra finca</button>
        <button type="button" onClick={onShowTechnical} className="flex flex-col items-center gap-1 text-xs text-silver-mist"><span className={actionButton}><UiIcon name="search" className="h-8 w-8" /></span>Cómo lo sabemos</button>
      </nav>
      <p className="text-center text-[10px] text-ash-gray lg:col-span-3">Imágenes: © Esri · OpenStreetMap</p>
    </div>
    {open && <RotationDetail result={open} best={openIndex === bestIndex} onClose={() => setOpenIndex(null)} />}
  </main>;
}
