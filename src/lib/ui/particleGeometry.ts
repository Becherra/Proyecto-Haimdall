export type ParticlePosition = [number, number, number];

/** Samples the entire ordered surface instead of truncating its southern half. */
export function sampleWholeSurface(points: ParticlePosition[], count: number): ParticlePosition[] {
  if (!points.length || count <= 0) return [];
  return Array.from({ length: Math.min(count, points.length) }, (_, index) =>
    points[Math.floor(index * points.length / Math.min(count, points.length))]);
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PALETTE = ["#ffb829", "#8052ff", "#15846e", "#ffffff"] as const;

/** Distributes samples evenly across a sphere using a Fibonacci spiral. */
export function generateFibonacciSphere(count: number, radius = 1): ParticlePosition[] {
  if (!Number.isInteger(count) || count < 0 || !Number.isFinite(radius) || radius < 0) {
    throw new RangeError("count y radius deben ser valores no negativos válidos.");
  }

  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / count;
    const ringRadius = Math.sqrt(1 - y * y);
    const angle = GOLDEN_ANGLE * index;
    return [Math.cos(angle) * ringRadius * radius, y * radius, Math.sin(angle) * ringRadius * radius];
  });
}

/** Distinguishes Blue Marble land from its dark blue ocean pixels. */
export function isLandPixel(red: number, green: number, blue: number): boolean {
  return green > blue * 0.78 && green > red * 0.68;
}

/** Picks repeatable color clusters so the particle world has no random flicker. */
export function getParticleColor(position: ParticlePosition): string {
  const cellValue = Math.sin(
    Math.floor((position[0] + 1) * 6) * 12.9898
      + Math.floor((position[1] + 1) * 6) * 78.233
      + Math.floor((position[2] + 1) * 6) * 37.719,
  ) * 43758.5453;
  const clusteredValue = fract(cellValue);

  if (clusteredValue < 0.499) return PALETTE[0];
  if (clusteredValue < 0.779) return PALETTE[1];
  if (clusteredValue < 0.885) return PALETTE[2];
  return PALETTE[3];
}

function fract(value: number): number {
  return value - Math.floor(value);
}
