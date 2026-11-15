/** Sides are local buckets selected for field-size estimates, not survey measurements. */
export const APPROXIMATE_AREA_RANGES_HA = [
  [0.01, 1],
  [1, 5],
  [5, 20],
  [20, 100],
] as const;

/** UI representative value for a bucket is its midpoint, making estimates deterministic. */
export function representativeAreaHa([minimum, maximum]: readonly [number, number]): number {
  return (minimum + maximum) / 2;
}

// 0.01 ha keeps a meaningful minimum for small farms; below this the estimate is not useful here.
export const MIN_TERRAIN_AREA_HA = 0.01;
// Larger than 1,000 ha is unusual for this workflow and should be confirmed by the user.
export const LARGE_TERRAIN_WARNING_HA = 1_000;
// 10,000 ha is rejected to catch coordinate/area mistakes before they reach analysis.
export const MAX_TERRAIN_AREA_HA = 10_000;
// The local planar projection is intended below 85° latitude and does not model polar distortion.
export const MAX_TERRAIN_ABS_LATITUDE = 85;
// One football pitch is a user-facing approximation only; it is not a measurement source.
export const FOOTBALL_PITCH_AREA_HA = 0.714;
