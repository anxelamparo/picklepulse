import type { ScoringRules } from "./types";

export type ScoreCheck = { ok: true } | { ok: false; reason: string; soft: boolean };

/**
 * Checks a FINAL score against the rules. `soft` problems (nobody reached the
 * target) can be confirmed by the scorekeeper; hard problems cannot be saved.
 */
export function checkFinal(a: number, b: number, rules: ScoringRules): ScoreCheck {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)
    return { ok: false, reason: "Scores must be whole numbers.", soft: false };
  if (a === b) return { ok: false, reason: "A final score cannot be tied.", soft: false };
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (rules.cap && hi > rules.cap)
    return { ok: false, reason: `Score is above the cap of ${rules.cap}.`, soft: false };
  if (hi < rules.targetScore)
    return { ok: false, reason: `Neither side reached ${rules.targetScore}.`, soft: true };
  if (hi - lo < rules.winBy && !(rules.cap && hi === rules.cap))
    return { ok: false, reason: `Winner must lead by ${rules.winBy}.`, soft: true };
  return { ok: true };
}
