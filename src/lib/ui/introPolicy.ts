export type IntroPolicyReason =
  | "disabled"
  | "reduced-motion"
  | "session-seen"
  | "webgl-unavailable"
  | "ready";

export type IntroPolicyInput = {
  enabled: boolean;
  reducedMotion: boolean;
  sessionSeen: boolean;
  webglAvailable: boolean;
};

export type IntroPolicy = {
  animate: boolean;
  reason: IntroPolicyReason;
};

export function resolveIntroPolicy(input: IntroPolicyInput): IntroPolicy {
  if (!input.enabled) return { animate: false, reason: "disabled" };
  if (input.reducedMotion) return { animate: false, reason: "reduced-motion" };
  if (input.sessionSeen) return { animate: false, reason: "session-seen" };
  if (!input.webglAvailable) return { animate: false, reason: "webgl-unavailable" };
  return { animate: true, reason: "ready" };
}
