"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useBundle, useNow } from "@/lib/hooks";
import { getRepo } from "@/lib/repo";
import { BrandShell, ClubMark, EntryLogo } from "@/components/Brand";
import { checkFinal } from "@/lib/engine";
import {
  categoryLabel, courtsOf, currentMatch, cursorSlot, entryName, entryOf, isFinal, matchTime, poolLabel, sides, timerText,
} from "@/lib/selectors";
import { clearMatch, draftFor, moveCourt, restartTimer, saveMatch, togglePlayer, type Draft } from "@/lib/actions";
import type { EventBundle } from "@/lib/types";

export default function Admin() {
  const { club, event } = useParams<{ club: string; event: string }>();
  const { bundle: b, state, error, reload } = useBundle(club, event);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    const r = getRepo();
    if (r.mode === "local") return setAllowed(true);
    void r.getClub().then((c) => setAllowed(!!c && c.slug === club));
  }, [club]);

  if (state === "loading" || allowed === null) return <BrandShell><p className="p-8">Loading…</p></BrandShell>;
  if (state === "error") return <BrandShell><p className="p-8">Could not load: {error}</p></BrandShell>;
  if (!b) return <BrandShell><p className="p-8">Event not found.</p></BrandShell>;
  if (!allowed)
    return (
      <BrandShell club={b.club}>
        <div className="mx-auto max-w-md p-8 text-center">
          <p className="mb-4">Sign in as an organizer or scorekeeper of {b.club.name} to enter scores.</p>
          <Link href="/login" className="pp-btn brand inline-block">Sign in</Link>
        </div>
      </BrandShell>
    );
  return <AdminBody b={b} reload={reload} />;
}

function AdminBody({ b, reload }: { b: EventBundle; reload: () => Promise<void> }) {
  const cfg = b.event.config;
  const [court, setCourt] = useState(1);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [soft, setSoft] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  const list = useMemo(() => b.matches.filter((m) => m.court === court), [b, court]);
  const sel = b.matches.find((m) => m.id === matchId) ?? null;

  // select the court's ongoing game when the court (or its ongoing game) changes
  const curId = currentMatch(b, court)?.id ?? null;
  useEffect(() => {
    const m = curId ? b.matches.find((x) => x.id === curId) : list[0];
    if (m) pick(m.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [court, curId]);

  function pick(id: string) {
    const m = b.matches.find((x) => x.id === id);
    if (!m) return;
    setMatchId(id);
    setDraft(draftFor(b, m));
    setSoft(false);
  }
  const flash = (t: string, err = false) => {
    setMsg({ t, err });
    setTimeout(() => setMsg(null), err ? 7000 : 3500);
  };
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Not saved", true);
    } finally {
      setBusy(false);
    }
  }

  function save(mode: "live" | "final" | "lineup") {
    if (!sel || !draft) return;
    if (mode !== "lineup") {
      const a = parseInt(draft.a), c = parseInt(draft.b);
      if (Number.isNaN(a) || Number.isNaN(c)) return flash("Enter both scores first", true);
      if (mode === "final") {
        const chk = checkFinal(a, c, cfg.rules);
        if (!chk.ok && (!chk.soft || !soft)) {
          if (chk.soft) setSoft(true);
          return flash(chk.soft ? `${chk.reason} Press SAVE FINAL again to confirm.` : chk.reason, true);
        }
      }
    }
    void run(async () => {
      const r = await saveMatch(b, sel, draft, mode);
      setSoft(false);
      flash(mode === "lineup" ? "Players & teams saved" : mode === "final" ? (r.advancedTo ? `FINAL saved · Court ${sel.court} moved to the next game` : "FINAL saved") : "Live score updated");
    });
  }

  const roster = (entryId: string) => entryOf(b, entryId)?.players ?? [];
  const cat = cfg.categories.find((c) => c.code === sel?.category);
  const teamsMode = cfg.entryType === "teams";

  return (
    <BrandShell club={b.club}>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 p-4">
        <ClubMark club={b.club} size={40} />
        <div>
          <div className="pp-display text-2xl leading-none">{b.event.name}</div>
          <div className="text-xs font-bold uppercase" style={{ color: "var(--mut)" }}>Scorekeeper</div>
        </div>
        <Link href={`/e/${b.club.slug}/${b.event.slug}`} className="pp-btn ml-auto">View live page</Link>
        <Link href={`/e/${b.club.slug}/${b.event.slug}/tv`} className="pp-btn">TV mode</Link>
      </header>
      {msg && <div className={`fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[92vw] rounded-xl px-4 py-2 font-bold ${msg.err ? "bg-red-600" : ""}`} style={msg.err ? undefined : { background: "var(--brand)", color: "var(--ink)" }}>{msg.t}</div>}

      <main className="mx-auto max-w-5xl space-y-5 p-4">
        {/* 1 · ongoing game per court */}
        <section className="pp-card p-4">
          <h2 className="pp-display mb-3 text-xl" style={{ color: "var(--brand)" }}>1 · Ongoing game per court</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {courtsOf(b).map((c) => {
              const cm = currentMatch(b, c);
              const cs = cursorSlot(b, c);
              const mine = b.matches.filter((m) => m.court === c);
              const prev = [...mine].reverse().find((m) => m.slot < cs);
              const nxt = mine.find((m) => m.slot > cs);
              const t = timerText(b, c, now);
              return (
                <div key={c} className={`rounded-xl border-2 p-3 ${court === c ? "" : "border-white/10"}`} style={court === c ? { borderColor: "var(--brand)" } : undefined}>
                  <div className="flex items-center justify-between">
                    <b className="pp-display text-xl" style={{ color: "var(--brand)" }}>Court {c}</b>
                    {t && <span className="pp-tmr">⏱ {t}</span>}
                  </div>
                  <div className="my-1 min-h-10 text-sm font-bold">
                    {cm ? `${cm.category ?? poolLabel(cm.poolId)} · ${entryName(b, sides(b, cm).a)} vs ${entryName(b, sides(b, cm).b)}` : "No game at this slot"}
                  </div>
                  <select className="pp-input text-sm" value={cm?.slot ?? cs} onChange={(e) => void run(() => moveCourt(b, c, +e.target.value))}>
                    {!cm && <option value={cs}>Slot {cs} — no game</option>}
                    {mine.map((m) => (
                      <option key={m.id} value={m.slot}>
                        {matchTime(b, m)} · {m.category ?? poolLabel(m.poolId)} · {entryName(b, m.a)} vs {entryName(b, m.b)}{isFinal(b, m) ? " ✔" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <button className="pp-btn" disabled={!prev || busy} onClick={() => prev && void run(() => moveCourt(b, c, prev.slot))}>◀ Prev</button>
                    <button className="pp-btn brand" disabled={!nxt || busy} onClick={() => nxt && void run(() => moveCourt(b, c, nxt.slot))}>Next ▶</button>
                    <button className="pp-btn" disabled={!cm || busy} title="Restart timer" onClick={() => void run(() => restartTimer(b, c))}>⏱</button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--mut)" }}>
            Each court moves on its own. After you save a FINAL result the court jumps to its next game by itself; you can still pick any game above.
          </p>
        </section>

        {/* 2 · enter score */}
        <section className="pp-card p-4">
          <h2 className="pp-display mb-3 text-xl" style={{ color: "var(--brand)" }}>2 · Enter score</h2>
          <div className="mb-3 flex gap-2">
            {courtsOf(b).map((c) => (
              <button key={c} onClick={() => setCourt(c)} className={`pp-btn flex-1 ${court === c ? "brand" : ""}`}>Court {c}</button>
            ))}
          </div>
          <div className="mb-4 max-h-64 space-y-1 overflow-auto">
            {list.map((m) => {
              const r = b.results[m.id];
              return (
                <button key={m.id} onClick={() => pick(m.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-bold ${m.id === matchId ? "" : "border-white/10"}`}
                  style={m.id === matchId ? { borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 12%, transparent)" } : undefined}>
                  <span style={{ color: "var(--mut)" }}>#{m.n}</span>
                  <span>{matchTime(b, m)}</span>
                  <span style={{ color: "var(--brand)" }}>{m.category ?? poolLabel(m.poolId)}</span>
                  <span className="flex-1 truncate">{entryName(b, sides(b, m).a)} vs {entryName(b, sides(b, m).b)}</span>
                  <span className={`pp-chip ${r?.final ? "brand" : r ? "live" : ""}`}>{r?.final ? `FINAL ${r.a}–${r.b}` : r ? `LIVE ${r.a}–${r.b}` : "SCHEDULED"}</span>
                </button>
              );
            })}
          </div>

          {sel && draft && (
            <div className="rounded-xl border-2 p-3" style={{ borderColor: "var(--brand)" }}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <b className="pp-display text-xl" style={{ color: "var(--brand)" }}>
                  Court {sel.court} · {teamsMode ? categoryLabel(b, sel.category) : poolLabel(sel.poolId)} · {matchTime(b, sel)}
                </b>
                {b.results[sel.id]?.final && <span className="pp-chip brand">EDITING FINAL RESULT</span>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(["a", "b"] as const).map((k) => {
                  const ek = k === "a" ? "ea" : "eb";
                  const pk = k === "a" ? "pa" : "pb";
                  const other = k === "a" ? draft.eb : draft.ea;
                  const entryId = draft[ek];
                  const players = roster(entryId);
                  const pool = b.entries.filter((e) => (sel.poolId === "all" ? true : e.level === sel.level) && e.id !== other);
                  return (
                    <div key={k} className="pp-card p-3">
                      <div className="flex items-center gap-2">
                        <EntryLogo entry={entryOf(b, entryId)} size={44} />
                        <select className="pp-input" value={entryId} onChange={(e) => setDraft({ ...draft, [ek]: e.target.value, [pk]: [] })}>
                          {pool.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                      <div className="my-3 flex items-center gap-2">
                        <button className="pp-btn" onClick={() => setDraft({ ...draft, [k]: String(Math.max(0, (parseInt(draft[k]) || 0) - 1)) })}>−1</button>
                        <input className="pp-input pp-display text-center text-3xl" inputMode="numeric" value={draft[k]} placeholder="0"
                          onChange={(e) => { setDraft({ ...draft, [k]: e.target.value.replace(/\D/g, "") }); setSoft(false); }} />
                        <button className="pp-btn" onClick={() => setDraft({ ...draft, [k]: String((parseInt(draft[k]) || 0) + 1) })}>+1</button>
                      </div>
                      {teamsMode ? (
                        <div className="flex flex-wrap gap-1.5">
                          {players.map((p) => (
                            <button key={p.id} onClick={() => setDraft({ ...draft, [pk]: togglePlayer(draft[pk], p, players, cat) })}
                              className="pp-chip" style={draft[pk].includes(p.id) ? { background: "var(--brand)", color: "var(--ink)" } : undefined}>
                              {p.name}{p.gender ? ` · ${p.gender}` : ""}
                            </button>
                          ))}
                          <span className="w-full text-xs" style={{ color: "var(--mut)" }}>{draft[pk].length} player(s) picked (optional)</span>
                        </div>
                      ) : (
                        <div className="text-sm font-bold" style={{ color: "var(--mut)" }}>{players.map((p) => p.name).join(" / ")}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="pp-btn brand" disabled={busy} onClick={() => save("final")}>✔ Save final</button>
                <button className="pp-btn" disabled={busy} onClick={() => save("live")}>Save live score</button>
                {teamsMode && <button className="pp-btn amber" disabled={busy} onClick={() => save("lineup")}>👥 Save players &amp; teams only</button>}
                {b.results[sel.id] && <button className="pp-btn red" disabled={busy} onClick={() => void run(async () => { await clearMatch(b, sel); pick(sel.id); flash("Result cleared"); })}>Clear result</button>}
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--mut)" }}>
                Scoring: first to {cfg.rules.targetScore}, win by {cfg.rules.winBy}{cfg.rules.cap ? `, cap ${cfg.rules.cap}` : ""}. Only FINAL results count in the standings.
              </p>
            </div>
          )}
        </section>
      </main>
    </BrandShell>
  );
}
