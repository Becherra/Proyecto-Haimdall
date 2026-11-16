import { UiIcon } from "./icons";

type PlayProps = { playing: boolean; onClick: () => void; size?: "small" | "big" };

/** Botón de escuchar/parar la lectura en voz alta. */
export function PlayButton({ playing, onClick, size = "small" }: PlayProps) {
  const dimension = size === "big" ? "h-24 w-full gap-3 text-xl font-bold" : "h-14 w-14 shrink-0";
  return <button type="button" onClick={onClick} aria-label={playing ? "Parar" : "Escuchar"} aria-pressed={playing} className={`flex items-center justify-center rounded-full bg-cream text-meadow shadow-lg transition hover:bg-bone-white focus:outline-none focus:ring-4 focus:ring-cream/50 ${dimension}`}>
    <UiIcon name={playing ? "stop" : "speaker"} className={size === "big" ? "h-12 w-12" : "h-8 w-8"} />
    {size === "big" && <span>{playing ? "Parar" : "Escuchar"}</span>}
  </button>;
}
