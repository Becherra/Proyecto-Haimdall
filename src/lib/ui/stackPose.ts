/** Posición visual de una tarjeta de la pila de preguntas. */
export type StackPose = { y: number; yPercent: number; rotation: number; scale: number; opacity: number };

/** Separación vertical entre tarjetas que asoman detrás de la activa, en px. */
const PEEK_OFFSET_PX = 16;
/** Cuánto se encoge cada tarjeta por nivel de profundidad. */
const PEEK_SCALE_STEP = 0.06;
/** Cuánto se desvanece cada tarjeta por nivel de profundidad. */
const PEEK_FADE_STEP = 0.25;
/** Más allá de este nivel la tarjeta no se ve. */
const MAX_VISIBLE_DEPTH = 2;

/**
 * Pose de una tarjeta según su posición relativa a la activa.
 * offset < 0: ya contestada (sale volando hacia arriba); 0: activa; > 0: asoma detrás.
 */
export function stackPose(offset: number): StackPose {
  if (offset < 0) return { y: 0, yPercent: -115, rotation: -5, scale: 0.96, opacity: 0 };
  if (offset === 0) return { y: 0, yPercent: 0, rotation: 0, scale: 1, opacity: 1 };
  return {
    y: offset * PEEK_OFFSET_PX,
    yPercent: 0,
    rotation: 0,
    scale: 1 - offset * PEEK_SCALE_STEP,
    opacity: offset > MAX_VISIBLE_DEPTH ? 0 : 1 - offset * PEEK_FADE_STEP,
  };
}
