import type { EventBundle } from "./types";
import type { Match } from "./engine";
import { slotStart, formatClock } from "./engine";

export const entryOf = (b: EventBundle, id: string) => b.entries.find((e) => e.id === id);
export const entryName = (b: EventBundle, id: string) => entryOf(b, id)?.name ?? "?";

/** Teams that actually played: a substitution saved with the result wins over the schedule. */
export function sides(b: EventBundle, m: Match) {
  const r = b.results[m.id];
  return { a: r?.entryA ?? m.a, b: r?.entryB ?? m.b };
}

export const isFinal = (b: EventBundle, m: Match) => !!b.results[m.id]?.final;

export const courtsOf = (b: EventBundle) => Array.from({ length: b.event.config.courts }, (_, i) => i + 1);

export const cursorSlot = (b: EventBundle, court: number) => b.cursors[court]?.slot ?? 1;

export const currentMatch = (b: EventBundle, court: number) =>
  b.matches.find((m) => m.court === court && m.slot === cursorSlot(b, court)) ?? null;

export const nextMatch = (b: EventBundle, court: number) => {
  const s = cursorSlot(b, court);
  return b.matches.find((m) => m.court === court && m.slot > s && !isFinal(b, m)) ?? null;
};

export const matchTime = (b: EventBundle, m: Match) => formatClock(slotStart(b.event.config, m.slot));

export function categoryLabel(b: EventBundle, code: string | null) {
  if (!code) return "";
  return b.event.config.categories.find((c) => c.code === code)?.label ?? code;
}

export const poolLabel = (id: string) =>
  id === "all" ? "All levels" : id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function fmtDur(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/** Timer text for a court: elapsed while ongoing, total time once final. */
export function timerText(b: EventBundle, court: number, now: number) {
  const m = currentMatch(b, court);
  if (!m) return "";
  const r = b.results[m.id];
  if (r?.final) return r.startedAt && r.endedAt ? fmtDur(r.endedAt - r.startedAt) : "";
  const st = b.cursors[court]?.startedAt;
  return st ? fmtDur(now - st) : "";
}
