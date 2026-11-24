/** Skill levels a club can run. Clubs choose which ones to open per event. */
export const LEVELS = ["novice", "low_intermediate", "high_intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = {
  novice: "Novice",
  low_intermediate: "Low Intermediate",
  high_intermediate: "High Intermediate",
  advanced: "Advanced",
};

/** teams = club vs club (rosters, several categories); doubles = fixed pairs. */
export type EntryType = "teams" | "doubles";
/** separate = one round robin per level; mixed = one pool, level is only a label. */
export type LevelMode = "separate" | "mixed";
/** per_game = every category game is one win (our PPA setup); per_match = team wins by majority of games. */
export type WinMode = "per_game" | "per_match";

export interface Player {
  id: string;
  name: string;
  gender?: "M" | "W";
}

/** A team category such as Men's Doubles. need = players required from each gender (or any). */
export interface Category {
  code: string; // e.g. MD
  label: string; // e.g. Men's Doubles
  need: { M: number; W: number; any: number };
}

export const DEFAULT_CATEGORIES: Category[] = [
  { code: "MD", label: "Men's Doubles", need: { M: 2, W: 0, any: 0 } },
  { code: "WD", label: "Women's Doubles", need: { M: 0, W: 2, any: 0 } },
  { code: "XD", label: "Mixed Doubles", need: { M: 1, W: 1, any: 0 } },
];

export interface Entry {
  id: string;
  name: string;
  level: Level;
  /** teams: the roster. doubles: exactly the two players of the pair. */
  players: Player[];
  logoUrl?: string | null;
  color?: string | null;
}

export interface ScoringRules {
  targetScore: number; // 21 (rally) or 11 (side-out)
  winBy: 1 | 2;
  cap?: number | null; // hard cap, e.g. 15 / 25
}

export const DEFAULT_RULES: ScoringRules = { targetScore: 21, winBy: 1, cap: null };

export interface EventConfig {
  entryType: EntryType;
  levels: Level[];
  levelMode: LevelMode;
  categories: Category[]; // used when entryType = teams
  courts: number;
  startMin: number; // minutes from midnight, e.g. 14:00 = 840
  slotMin: number; // minutes per slot, e.g. 15
  rules: ScoringRules;
  winMode: WinMode;
  advance: number; // top N per pool that reach the finals (0 = none)
}

export interface Match {
  id: string; // stable, e.g. G01
  n: number;
  poolId: string; // level key (separate) or "all"
  level: Level;
  category: string | null; // teams only
  a: string; // entry id
  b: string; // entry id
  slot: number; // 1-based
  court: number; // 1-based
}

export interface MatchResult {
  a: number;
  b: number;
  final: boolean;
  /** players that actually played (teams: picked from the roster) */
  pa?: string[];
  pb?: string[];
  /** actual teams if different from the schedule (substitution of entry) */
  entryA?: string;
  entryB?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface StandingRow {
  entryId: string;
  gp: number;
  w: number;
  l: number;
  pf: number;
  pa: number;
  diff: number;
  /** wins/losses per category (teams mode) */
  byCategory: Record<string, [number, number]>;
  rank: number;
  advances: boolean;
}
