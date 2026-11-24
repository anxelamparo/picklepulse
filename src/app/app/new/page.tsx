"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { BrandShell } from "@/components/Brand";
import { useClub } from "@/lib/useClub";
import {
  DEFAULT_CATEGORIES, DEFAULT_RULES, LEVELS, LEVEL_LABEL, generateSchedule, scheduleSummary,
  type Entry, type EventConfig, type EntryType, type Level, type LevelMode, type Player,
} from "@/lib/engine";
import { sampleDoubles, sampleTeams } from "@/lib/sample";

interface Draft { id: string; name: string; level: Level; playersText: string; logoUrl?: string | null; color?: string | null }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/** "Anna M" / "Bea W" / "Cara" -> player with optional gender */
function parsePlayers(text: string): Player[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)(?:\s+|\s*\(|\s*-\s*)([MW])\)?$/i);
    return m && m[1] ? { id: crypto.randomUUID(), name: m[1].trim(), gender: m[2].toUpperCase() as "M" | "W" } : { id: crypto.randomUUID(), name: l };
  });
}
const playersToText = (ps: Player[]) => ps.map((p) => (p.gender ? `${p.name} ${p.gender}` : p.name)).join("\n");

function Opt({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`pp-btn ${on ? "brand" : ""}`}>{children}</button>;
}

export default function NewEvent() {
  const router = useRouter();
  const { club, loading } = useClub();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("teams");
  const [levels, setLevels] = useState<Level[]>(["advanced"]);
  const [levelMode, setLevelMode] = useState<LevelMode>("separate");
  const [cats, setCats] = useState<string[]>(["MD", "WD", "XD"]);
  const [winMode, setWinMode] = useState<"per_game" | "per_match">("per_game");
  const [advance, setAdvance] = useState(2);
  const [courts, setCourts] = useState(3);
  const [start, setStart] = useState("14:00");
  const [slotMin, setSlotMin] = useState(15);
  const [target, setTarget] = useState(21);
  const [winBy, setWinBy] = useState<1 | 2>(1);
  const [cap, setCap] = useState("");
  const [entries, setEntries] = useState<Draft[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const cfg: EventConfig = useMemo(() => ({
    entryType, levels, levelMode,
    categories: DEFAULT_CATEGORIES.filter((c) => cats.includes(c.code)),
    courts, startMin: toMin(start), slotMin,
    rules: { ...DEFAULT_RULES, targetScore: target, winBy, cap: cap ? Number(cap) : null },
    winMode, advance,
  }), [entryType, levels, levelMode, cats, courts, start, slotMin, target, winBy, cap, winMode, advance]);

  const built: Entry[] = useMemo(() => entries.map((e) => ({ id: e.id, name: e.name.trim(), level: e.level, logoUrl: e.logoUrl, color: e.color, players: parsePlayers(e.playersText) })), [entries]);

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!name.trim()) p.push("Give the event a name.");
    if (!levels.length) p.push("Pick at least one skill level.");
    if (entryType === "teams" && !cats.length) p.push("Pick at least one category.");
    for (const lv of cfg.levelMode === "mixed" ? ["all"] : levels) {
      const n = built.filter((e) => e.name && (lv === "all" || e.level === lv)).length;
      if (n < 2) p.push(`${lv === "all" ? "The event" : LEVEL_LABEL[lv as Level]} needs at least 2 ${entryType === "teams" ? "teams" : "pairs"}.`);
    }
    if (entryType === "doubles") for (const e of built) if (e.name && e.players.length !== 2) p.push(`"${e.name}" needs exactly 2 players (one per line).`);
    return p;
  }, [name, levels, entryType, cats, built, cfg.levelMode]);

  const schedule = useMemo(() => (step === 5 && !problems.length ? generateSchedule(built.filter((e) => e.name), cfg) : []), [step, problems, built, cfg]);
  const summary = scheduleSummary(schedule, cfg);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const addEntry = (level: Level) => setEntries((l) => [...l, { id: crypto.randomUUID(), name: "", level, playersText: "" }]);
  const upd = (id: string, patch: Partial<Draft>) => setEntries((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const loadSample = () => {
    const lv = levels[0] ?? "advanced";
    const s = entryType === "teams" ? sampleTeams(lv) : sampleDoubles(lv);
    setEntries(s.map((e) => ({ id: e.id, name: e.name, level: e.level, playersText: playersToText(e.players), color: e.color })));
    if (!name) setName("Sample Tournament");
  };

  async function create() {
    if (!club) return;
    setBusy(true);
    setErr("");
    try {
      const final = built.filter((e) => e.name);
      const matches = generateSchedule(final, cfg);
      const ev = await getRepo().createEvent({ name: name.trim(), slug: slugify(name) || "event", config: cfg, entries: final, matches });
      router.push(`/app/${club.slug}/${ev.slug}/admin`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the event");
      setBusy(false);
    }
  }

  if (loading) return <BrandShell><p className="p-8">Loading…</p></BrandShell>;
  if (!club) return <BrandShell><p className="p-8">Create your club first. <Link className="underline" href="/app">Go to dashboard</Link></p></BrandShell>;

  const steps = ["Basics", "Format", "Courts & scoring", "Teams / pairs", "Review"];

  return (
    <BrandShell club={club}>
      <div className="mx-auto max-w-3xl space-y-5 p-4">
        <Link href="/app" className="text-sm underline">← Dashboard</Link>
        <h1 className="pp-display text-3xl">New event</h1>
        <ol className="flex flex-wrap gap-2 text-xs font-bold">
          {steps.map((s, i) => (
            <li key={s} className={`pp-chip ${step === i + 1 ? "brand" : ""}`}>{i + 1}. {s}</li>
          ))}
        </ol>

        {step === 1 && (
          <section className="pp-card space-y-3 p-4">
            <label className="pp-label">Event name</label>
            <input className="pp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Club Championship" />
            <p className="text-xs" style={{ color: "var(--mut)" }}>Public link: /e/{club.slug}/{slugify(name) || "…"}</p>
          </section>
        )}

        {step === 2 && (
          <section className="pp-card space-y-4 p-4">
            <div>
              <label className="pp-label">Who plays?</label>
              <div className="flex flex-wrap gap-2">
                <Opt on={entryType === "teams"} onClick={() => setEntryType("teams")}>Teams (club vs club)</Opt>
                <Opt on={entryType === "doubles"} onClick={() => setEntryType("doubles")}>Doubles (pairs)</Opt>
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--mut)" }}>
                {entryType === "teams" ? "Each team has a roster. Every pair of teams plays one game per category." : "Each entry is a fixed pair. Every pair plays every other pair once."}
              </p>
            </div>
            {entryType === "teams" && (
              <div>
                <label className="pp-label">Categories per team match</label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_CATEGORIES.map((c) => <Opt key={c.code} on={cats.includes(c.code)} onClick={() => setCats(toggle(cats, c.code))}>{c.label}</Opt>)}
                </div>
                <label className="pp-label mt-3">How does a team win?</label>
                <div className="flex flex-wrap gap-2">
                  <Opt on={winMode === "per_game"} onClick={() => setWinMode("per_game")}>Every game is a win</Opt>
                  <Opt on={winMode === "per_match"} onClick={() => setWinMode("per_match")}>Best of the categories</Opt>
                </div>
              </div>
            )}
            <div>
              <label className="pp-label">Skill levels</label>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => <Opt key={l} on={levels.includes(l)} onClick={() => setLevels(toggle(levels, l))}>{LEVEL_LABEL[l]}</Opt>)}
              </div>
              {levels.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Opt on={levelMode === "separate"} onClick={() => setLevelMode("separate")}>Separate standings per level</Opt>
                  <Opt on={levelMode === "mixed"} onClick={() => setLevelMode("mixed")}>One pool, levels are labels</Opt>
                </div>
              )}
            </div>
            <div>
              <label className="pp-label">Advance to finals (per group)</label>
              <input className="pp-input w-24" type="number" min={0} max={8} value={advance} onChange={(e) => setAdvance(+e.target.value)} />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="pp-card grid gap-4 p-4 sm:grid-cols-2">
            <div><label className="pp-label">Courts</label><input className="pp-input" type="number" min={1} max={20} value={courts} onChange={(e) => setCourts(Math.max(1, +e.target.value))} /></div>
            <div><label className="pp-label">First game starts</label><input className="pp-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="pp-label">Minutes per slot</label><input className="pp-input" type="number" min={5} max={120} value={slotMin} onChange={(e) => setSlotMin(Math.max(5, +e.target.value))} /></div>
            <div><label className="pp-label">Play to</label><input className="pp-input" type="number" min={5} max={31} value={target} onChange={(e) => setTarget(+e.target.value)} /></div>
            <div><label className="pp-label">Win by</label><div className="flex gap-2"><Opt on={winBy === 1} onClick={() => setWinBy(1)}>1 (rally)</Opt><Opt on={winBy === 2} onClick={() => setWinBy(2)}>2</Opt></div></div>
            <div><label className="pp-label">Score cap (optional)</label><input className="pp-input" type="number" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="none" /></div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button className="pp-btn amber" onClick={loadSample}>Fill with sample {entryType === "teams" ? "teams" : "pairs"}</button>
              <span className="text-xs" style={{ color: "var(--mut)" }}>
                {entryType === "teams" ? "One player per line. Add M or W after the name (e.g. “Anna W”) so mixed games pick the right players." : "Exactly two players per pair, one per line."}
              </span>
            </div>
            {(levelMode === "mixed" ? [levels[0]] : levels).map((lv) => (
              <div key={lv} className="pp-card space-y-3 p-4">
                <h3 className="pp-display text-xl" style={{ color: "var(--brand)" }}>{levelMode === "mixed" ? "All levels" : LEVEL_LABEL[lv]}</h3>
                {entries.filter((e) => levelMode === "mixed" || e.level === lv).map((e) => (
                  <div key={e.id} className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-[1fr_1fr]">
                    <div className="space-y-2">
                      <input className="pp-input" placeholder={entryType === "teams" ? "Team name" : "Pair name"} value={e.name} onChange={(ev) => upd(e.id, { name: ev.target.value })} />
                      {levelMode === "mixed" && (
                        <select className="pp-input" value={e.level} onChange={(ev) => upd(e.id, { level: ev.target.value as Level })}>
                          {levels.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                        </select>
                      )}
                      <div className="flex items-center gap-2">
                        <input type="color" value={e.color ?? "#233461"} onChange={(ev) => upd(e.id, { color: ev.target.value })} className="h-10 w-12 rounded" aria-label="Team color" />
                        <label className="pp-btn cursor-pointer text-xs">
                          {e.logoUrl ? "Change logo" : "Upload logo"}
                          <input type="file" accept="image/*" className="hidden" onChange={async (ev) => {
                            const f = ev.target.files?.[0];
                            if (f) upd(e.id, { logoUrl: await getRepo().uploadLogo(f, e.id) });
                          }} />
                        </label>
                        <button className="pp-btn red text-xs" onClick={() => setEntries((l) => l.filter((x) => x.id !== e.id))}>Remove</button>
                      </div>
                    </div>
                    <textarea className="pp-input min-h-24" placeholder={"Players, one per line\nAnna W\nBen M"} value={e.playersText} onChange={(ev) => upd(e.id, { playersText: ev.target.value })} />
                  </div>
                ))}
                <button className="pp-btn" onClick={() => addEntry(lv)}>+ Add {entryType === "teams" ? "team" : "pair"}</button>
              </div>
            ))}
          </section>
        )}

        {step === 5 && (
          <section className="pp-card space-y-3 p-4">
            {problems.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--amber)" }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="pp-brandcard p-3"><div className="pp-display text-3xl">{summary.games}</div><div className="text-xs">games</div></div>
                  <div className="pp-brandcard p-3"><div className="pp-display text-3xl">{summary.slots}</div><div className="text-xs">time slots</div></div>
                  <div className="pp-brandcard p-3"><div className="pp-display text-3xl">{summary.endsAt}</div><div className="text-xs">estimated finish</div></div>
                </div>
                <p className="text-sm" style={{ color: "var(--mut)" }}>
                  Every {entryType === "teams" ? "team" : "pair"} meets every other one in its group. Nobody is booked on two courts at the same time.
                </p>
                {err && <p className="text-sm text-red-400">{err}</p>}
                <button className="pp-btn brand w-full" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create event & open scorekeeper"}</button>
              </>
            )}
          </section>
        )}

        <div className="flex justify-between">
          <button className="pp-btn" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>← Back</button>
          {step < 5 && <button className="pp-btn brand" onClick={() => setStep((s) => s + 1)}>Next →</button>}
        </div>
      </div>
    </BrandShell>
  );
}
