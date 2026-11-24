"use client";
import { useMemo } from "react";
import { computeStandings } from "@/lib/engine";
import type { EventBundle } from "@/lib/types";
import { EntryLogo } from "../Brand";
import { useNow } from "@/lib/hooks";
import {
  categoryLabel, courtsOf, currentMatch, entryOf, entryName, isFinal, matchTime, nextMatch, poolLabel, sides, timerText, cursorSlot,
} from "@/lib/selectors";

export function useStandings(b: EventBundle) {
  return useMemo(() => computeStandings(b.entries, b.matches, b.results, b.event.config), [b]);
}

export function StandingsView({ b }: { b: EventBundle }) {
  const st = useStandings(b);
  const teams = b.event.config.entryType === "teams";
  const cats = b.event.config.categories;
  const done = b.matches.filter((m) => isFinal(b, m)).length;
  return (
    <div className="space-y-6">
      {Object.entries(st).map(([pool, rows]) => (
        <section key={pool} className="pp-brandcard overflow-x-auto p-3">
          <h3 className="pp-display px-2 pb-1 text-xl" style={{ color: "var(--brand)" }}>
            {poolLabel(pool)} · Standings
          </h3>
          <table className="pp-table w-full min-w-[560px]">
            <thead>
              <tr>
                <th>#</th><th>{teams ? "Team" : "Pair"}</th><th>GP</th>
                {teams && cats.map((c) => <th key={c.code}>{c.code}</th>)}
                <th>W</th><th>L</th><th>+/−</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = entryOf(b, r.entryId);
                return (
                  <tr key={r.entryId} className={r.advances ? "pp-advance" : ""}>
                    <td className="pp-display text-xl">{r.rank}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <EntryLogo entry={e} size={34} />
                        <span className="pp-display text-lg">{e?.name}</span>
                        {r.advances && <span className="pp-chip brand">FINALS</span>}
                      </span>
                    </td>
                    <td>{r.gp}</td>
                    {teams && cats.map((c) => <td key={c.code}>{(r.byCategory[c.code] ?? [0, 0]).join("-")}</td>)}
                    <td style={{ color: "var(--brand)" }}>{r.w}</td>
                    <td>{r.l}</td>
                    <td>{r.diff > 0 ? "+" : ""}{r.diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      <p className="text-sm" style={{ color: "var(--mut)" }}>
        {done}/{b.matches.length} games played{b.event.config.advance ? ` · top ${b.event.config.advance} of each group advance` : ""}
      </p>
    </div>
  );
}

export function CourtCard({ b, court }: { b: EventBundle; court: number }) {
  const now = useNow();
  const m = currentMatch(b, court);
  const nx = nextMatch(b, court);
  const t = timerText(b, court, now);
  if (!m)
    return (
      <div className="pp-brandcard p-4">
        <div className="flex items-center justify-between">
          <span className="pp-display text-2xl" style={{ color: "var(--brand)" }}>Court {court}</span>
          <span className="pp-chip">NO GAME</span>
        </div>
        {nx && <NextLine b={b} court={court} />}
      </div>
    );
  const r = b.results[m.id];
  const s = sides(b, m);
  const final = !!r?.final;
  const row = (id: string, score?: number, other?: number) => (
    <div key={id} className="flex items-center gap-3 py-2">
      <EntryLogo entry={entryOf(b, id)} size={46} />
      <span className="pp-display flex-1 text-xl leading-none">
        {entryName(b, id)}
        <PlayerNames b={b} ids={id === s.a ? r?.pa : r?.pb} />
      </span>
      <span className={`pp-display grid h-14 w-16 place-items-center rounded-xl border-2 text-3xl ${final && (score ?? 0) > (other ?? 0) ? "" : "opacity-90"}`}
        style={{ borderColor: "var(--brand)", background: "#050a14", color: final && (score ?? 0) > (other ?? 0) ? "var(--brand)" : "#fff" }}>
        {score ?? "–"}
      </span>
    </div>
  );
  return (
    <div className="pp-brandcard p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pp-display text-2xl" style={{ color: "var(--brand)" }}>Court {court}</span>
        <span className="text-xs font-extrabold uppercase" style={{ color: "var(--mut)" }}>
          {b.event.config.entryType === "teams" ? categoryLabel(b, m.category) : poolLabel(m.poolId)} · {matchTime(b, m)}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {t && <span className="pp-tmr">⏱ {t}</span>}
          <span className={`pp-chip ${final ? "brand" : r ? "live" : ""}`}>{final ? "FINAL" : r ? "LIVE" : "NEXT UP"}</span>
        </span>
      </div>
      {row(s.a, r?.a, r?.b)}
      <div className="pp-display text-center text-sm" style={{ color: "var(--brand)" }}>VS</div>
      {row(s.b, r?.b, r?.a)}
      <NextLine b={b} court={court} />
    </div>
  );
}

function PlayerNames({ b, ids }: { b: EventBundle; ids?: string[] }) {
  if (!ids?.length) return null;
  const names = ids.map((id) => b.entries.flatMap((e) => e.players).find((p) => p.id === id)?.name).filter(Boolean);
  return <small className="block text-xs font-semibold normal-case not-italic" style={{ color: "var(--mut)" }}>{names.join(" / ")}</small>;
}

function NextLine({ b, court }: { b: EventBundle; court: number }) {
  const n = nextMatch(b, court);
  return (
    <div className="mt-2 border-t border-white/10 pt-2 text-xs font-bold uppercase" style={{ color: "#cfd8ee" }}>
      <span style={{ color: "var(--brand)" }}>NEXT </span>
      {n ? `${matchTime(b, n)} · ${n.category ?? poolLabel(n.poolId)} · ${entryName(b, n.a)} vs ${entryName(b, n.b)}` : "— no more games"}
    </div>
  );
}

export function CourtsView({ b }: { b: EventBundle }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courtsOf(b).map((c) => <CourtCard key={c} b={b} court={c} />)}
    </div>
  );
}

export function UpcomingView({ b, limit = 200 }: { b: EventBundle; limit?: number }) {
  const list = b.matches
    .filter((m) => m.slot > cursorSlot(b, m.court) && !isFinal(b, m))
    .sort((x, y) => x.slot - y.slot || x.court - y.court)
    .slice(0, limit);
  if (!list.length) return <p className="pp-card p-6 text-center">No more scheduled games. 🏁</p>;
  const groups = new Map<number, typeof list>();
  list.forEach((m) => groups.set(m.slot, [...(groups.get(m.slot) ?? []), m]));
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([slot, ms]) => (
        <div key={slot}>
          <div className="pp-display mb-1 text-lg" style={{ color: "var(--brand)" }}>{matchTime(b, ms[0])}</div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ms.map((m) => (
              <div key={m.id} className="pp-card flex items-center gap-2 p-2 text-sm font-bold">
                <span className="pp-chip brand">Court {m.court}</span>
                {m.category && <span className="pp-chip">{m.category}</span>}
                <EntryLogo entry={entryOf(b, m.a)} size={26} />
                <span className="truncate">{entryName(b, m.a)}</span>
                <span style={{ color: "var(--brand)" }}>vs</span>
                <span className="truncate">{entryName(b, m.b)}</span>
                <EntryLogo entry={entryOf(b, m.b)} size={26} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
