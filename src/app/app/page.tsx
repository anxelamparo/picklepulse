"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { BrandShell, ClubMark } from "@/components/Brand";
import { useClub } from "@/lib/useClub";
import type { EventMeta } from "@/lib/types";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 38);

export default function Dashboard() {
  const { club, loading, signedOut, setClub } = useClub();
  const [events, setEvents] = useState<EventMeta[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const repo = getRepo();

  useEffect(() => {
    if (club) void repo.listEvents().then(setEvents);
  }, [club, repo]);

  if (loading) return <BrandShell><p className="p-8">Loading…</p></BrandShell>;
  if (signedOut)
    return (
      <BrandShell>
        <div className="mx-auto max-w-md p-8 text-center">
          <p className="mb-4">Sign in to manage your club.</p>
          <Link href="/login" className="pp-btn brand inline-block">Sign in</Link>
        </div>
      </BrandShell>
    );

  if (!club)
    return (
      <BrandShell>
        <div className="mx-auto max-w-md space-y-3 p-6">
          <h1 className="pp-display text-3xl">Create your club</h1>
          <label className="pp-label">Club name</label>
          <input className="pp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manila Pickleball Club" />
          <p className="text-xs" style={{ color: "var(--mut)" }}>Your public pages will live at /e/{slugify(name) || "your-club"}/…</p>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button className="pp-btn brand w-full" disabled={!name.trim()} onClick={async () => {
            try { setClub(await repo.createClub(name.trim(), slugify(name))); } catch (e) { setErr(e instanceof Error ? e.message : "Could not create the club"); }
          }}>Create club</button>
        </div>
      </BrandShell>
    );

  return (
    <BrandShell club={club}>
      <div className="mx-auto max-w-4xl space-y-5 p-4">
        <header className="flex items-center gap-3">
          <ClubMark club={club} size={52} />
          <div>
            <h1 className="pp-display text-3xl leading-none">{club.name}</h1>
            <div className="text-xs font-bold uppercase" style={{ color: "var(--mut)" }}>PicklePulse · {repo.mode === "local" ? "demo mode (data stays in this browser)" : "live"}</div>
          </div>
          <Link href="/app/settings" className="pp-btn ml-auto">Branding</Link>
          <Link href="/app/new" className="pp-btn brand">+ New event</Link>
        </header>

        {repo.mode === "local" && (
          <p className="pp-card p-3 text-sm" style={{ color: "var(--amber)" }}>
            Demo mode: no database is connected, so events live only in this browser. Connect Supabase (see README) to share live pages with everyone.
          </p>
        )}

        {events.length === 0 ? (
          <p className="pp-card p-6 text-center">No events yet. Create your first one — it takes about two minutes.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="pp-card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="pp-display text-xl">{e.name}</div>
                  <div className="text-xs font-bold uppercase" style={{ color: "var(--mut)" }}>
                    {e.config.entryType === "teams" ? "Teams" : "Doubles"} · {e.config.courts} courts · {e.config.levels.length} level(s)
                  </div>
                </div>
                <Link className="pp-btn brand" href={`/app/${club.slug}/${e.slug}/admin`}>Scorekeeper</Link>
                <Link className="pp-btn" href={`/e/${club.slug}/${e.slug}`}>Live page</Link>
                <Link className="pp-btn" href={`/e/${club.slug}/${e.slug}/tv`}>TV</Link>
                <button className="pp-btn" onClick={() => navigator.clipboard?.writeText(`${location.origin}/e/${club.slug}/${e.slug}`)}>Copy link</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BrandShell>
  );
}
