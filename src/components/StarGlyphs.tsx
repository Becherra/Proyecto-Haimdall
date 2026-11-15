import { starFills, starsLabel } from "../lib/ui/resultsCopy";
import { UiIcon } from "./icons";

/**
 * Las cinco estrellas del puntaje, con medias estrellas. Cada una es una estrella tenue de fondo y, encima, la llena recortada
 * a la mitad cuando corresponde. `litClassName` se pone en las estrellas con relleno (la vista de resultados las anima con él).
 */
export function StarGlyphs({ score, iconClassName, litClassName = "" }: { score: number; iconClassName: string; litClassName?: string }) {
  return <span className="flex gap-1 text-cream" role="img" aria-label={starsLabel(score)}>
    {starFills(score).map((fill, index) => <span key={index} className="relative inline-flex">
      <span className="opacity-25"><UiIcon name="star" className={iconClassName} /></span>
      {fill > 0 && <span className={`absolute inset-0 ${litClassName}`} style={fill === 0.5 ? { clipPath: "inset(0 50% 0 0)" } : undefined}><UiIcon name="star" className={iconClassName} /></span>}
    </span>)}
  </span>;
}
