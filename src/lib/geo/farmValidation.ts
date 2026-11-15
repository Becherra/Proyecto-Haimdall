import { farmSchema, type Farm } from "../../types";
import { validateTerrain } from "./geometry";

export type FarmValidationResult =
  | { valid: true; farm: Farm; warnings: string[] }
  | { valid: false; errors: string[] };

/** Validates the shared Farm contract and its geographic terrain constraints. */
export function validateFarmDraft(input: unknown): FarmValidationResult {
  const parsed = farmSchema.safeParse(input);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => issue.message) };
  const terrain = validateTerrain(parsed.data.terrain);
  if (!terrain.valid) return { valid: false, errors: terrain.errors };
  return { valid: true, farm: parsed.data, warnings: terrain.warnings };
}
