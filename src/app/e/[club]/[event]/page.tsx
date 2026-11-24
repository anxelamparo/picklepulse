"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useBundle } from "@/lib/hooks";
import { BrandShell, ClubMark } from "@/components/Brand";
import { CourtsView, StandingsView, UpcomingView } from "@/components/live/Views";

const TABS = [["standings", "Standings"], ["courts", "Live Courts"], ["upcoming", "Upcoming"]] as const;

export default function PublicEvent() {
  const { club, event } = useParams<{ club: string; event: string }>();
  const { bundle: b, state, error } = useBundle(club, event);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("standings");
  if (state === "loading") return <BrandShell><p className="p-8">Loading…</p></BrandShell>;
  if (state === "error") return <BrandShell><p className="p-8">Could not load: {error}</p></BrandShell>;
  if (!b) return <BrandShell><p className="p-8">Event not found, or it is not public yet.</p></BrandShell>;
  return (
    <BrandShell club={b.club}>
      <header className="mx-auto flex max-w-6xl items-center gap-3 p-4">
        <ClubMark club={b.club} size={48} />
        <div className="min-w-0">
          <div className="pp-display text-2xl leading-none">{b.event.name}</div>
          <div className="text-xs font-bold uppercase" style={{ color: "var(--mut)" }}>{b.club.name} · powered by PicklePulse</div>
        </div>
        <span className="pp-chip live ml-auto">● LIVE</span>
        <Link href={`/e/${club}/${event}/tv`} className="pp-btn hidden sm:block">▶ TV mode</Link>
      </header>
      <nav className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-4">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`pp-btn ${tab === k ? "brand" : ""}`}>{l}</button>
        ))}
      </nav>
      <main className="mx-auto max-w-6xl p-4">
        {tab === "standings" && <StandingsView b={b} />}
        {tab === "courts" && <CourtsView b={b} />}
        {tab === "upcoming" && <UpcomingView b={b} />}
      </main>
    </BrandShell>
  );
}
