"use client";
import { getRepo } from "./repo";
import type { EventBundle } from "./types";
import type { Category, Match, MatchResult, Player } from "./engine";
import { cursorSlot } from "./selectors";

export interface Draft {
  a: string;
  b: string;
  ea: string; // entry that actually plays on side A
  eb: string;
  pa: string[];
  pb: string[];
}

export function draftFor(b: EventBundle, m: Match): Draft {
  const r = b.results[m.id];
  return {
    a: r ? String(r.a) : "",
    b: r ? String(r.b) : "",
    ea: r?.entryA ?? m.a,
    eb: r?.entryB ?? m.b,
    pa: r?.pa ?? [],
    pb: r?.pb ?? [],
  };
}

/** Pick a player respecting what the category needs (e.g. mixed = 1 man + 1 woman). */
export function togglePlayer(list: string[], p: Player, roster: Player[], cat: Category | undefined): string[] {
  if (list.includes(p.id)) return list.filter((x) => x !== p.id);
  const need = cat?.need ?? { M: 0, W: 0, any: 2 };
  const slotKey: "M" | "W" | "any" = p.gender && need[p.gender] > 0 ? p.gender : "any";
  const limit = need[slotKey] || (need.M + need.W + need.any || 2);
  const same = list.filter((id) => {
    const q = roster.find((r) => r.id === id);
    const k: "M" | "W" | "any" = q?.gender && need[q.gender] > 0 ? q.gender : "any";
    return k === slotKey;
  });
  const next = same.length >= limit ? list.filter((id) => id !== same[0]) : list;
  return [...next, p.id];
}

export async function saveMatch(b: EventBundle, m: Match, d: Draft, mode: "live" | "final" | "lineup") {
  const prev = b.results[m.id];
  const wasCurrent = cursorSlot(b, m.court) === m.slot;
  const startedAt = prev?.startedAt ?? (wasCurrent ? b.cursors[m.court]?.startedAt ?? undefined : undefined);
  const num = (s: string) => (s === "" ? NaN : parseInt(s, 10));
  const a = mode === "lineup" ? (Number.isNaN(num(d.a)) ? 0 : num(d.a)) : num(d.a);
  const bb = mode === "lineup" ? (Number.isNaN(num(d.b)) ? 0 : num(d.b)) : num(d.b);
  const res: MatchResult = {
    a, b: bb,
    final: mode === "final" ? true : mode === "lineup" ? !!prev?.final : false,
    pa: d.pa, pb: d.pb,
    ...(d.ea !== m.a ? { entryA: d.ea } : {}),
    ...(d.eb !== m.b ? { entryB: d.eb } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(mode === "final" ? { endedAt: prev?.endedAt ?? Date.now() } : prev?.endedAt && mode === "lineup" ? { endedAt: prev.endedAt } : {}),
  };
  await getRepo().saveResult(b, m.id, res);
  // auto-advance: the court moves on by itself after its ongoing game is final
  if (mode === "final" && wasCurrent) {
    const nx = b.matches.find((x) => x.court === m.court && x.slot > m.slot && !(b.results[x.id]?.final));
    if (nx) {
      await getRepo().setCursor(b, m.court, { slot: nx.slot, startedAt: Date.now() });
      return { advancedTo: nx };
    }
  }
  return { advancedTo: null as Match | null };
}

export const clearMatch = (b: EventBundle, m: Match) => getRepo().saveResult(b, m.id, null);
export const moveCourt = (b: EventBundle, court: number, slot: number) =>
  getRepo().setCursor(b, court, { slot, startedAt: Date.now() });
export const restartTimer = (b: EventBundle, court: number) =>
  getRepo().setCursor(b, court, { slot: cursorSlot(b, court), startedAt: Date.now() });
