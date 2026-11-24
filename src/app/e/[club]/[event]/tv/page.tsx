"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBundle } from "@/lib/hooks";
import { BrandShell, ClubMark } from "@/components/Brand";
import { CourtsView, StandingsView, UpcomingView } from "@/components/live/Views";

const SCREENS = [
  { k: "standings", label: "Standings", sec: 12 },
  { k: "courts", label: "Live Courts", sec: 12 },
  { k: "upcoming", label: "Upcoming", sec: 8 },
] as const;

export default function TvMode() {
  const { club, event } = useParams<{ club: string; event: string }>();
  const { bundle: b, state } = useBundle(club, event);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(1);
  const root = useRef<HTMLDivElement>(null);

  // auto-rotate (12s / 12s / 8s)
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % SCREENS.length), SCREENS[idx].sec * 1000);
    return () => clearTimeout(t);
  }, [idx, paused]);
  // scale the whole layout to any TV size
  useEffect(() => {
    const f = () => setScale(Math.max(0.8, Math.min(window.innerWidth / 1280, window.innerHeight / 720)) * 1.15);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  if (state !== "ready" || !b) return <BrandShell><p className="p-8">Loading TV mode…</p></BrandShell>;
  const s = SCREENS[idx];
  return (
    <BrandShell club={b.club}>
      <div ref={root} className="flex min-h-screen flex-col" style={{ zoom: scale }}>
        <header className="flex items-center gap-4 px-6 py-3">
          <ClubMark club={b.club} size={52} />
          <div>
            <div className="pp-display text-3xl leading-none">{b.event.name}</div>
            <div className="text-xs font-bold uppercase" style={{ color: "var(--mut)" }}>{b.club.name}</div>
          </div>
          <span className="pp-display ml-auto text-3xl" style={{ color: "var(--brand)" }}>{s.label}</span>
          <span className="pp-chip live">● LIVE</span>
        </header>
        <main className="flex-1 px-6 pb-4">
          {s.k === "standings" && <StandingsView b={b} />}
          {s.k === "courts" && <CourtsView b={b} />}
          {s.k === "upcoming" && <UpcomingView b={b} limit={12} />}
        </main>
        <footer className="flex items-center gap-2 px-6 pb-3 text-sm">
          {SCREENS.map((x, i) => (
            <button key={x.k} onClick={() => setIdx(i)} className={`pp-chip ${i === idx ? "brand" : ""}`}>{x.label}</button>
          ))}
          <button className="pp-chip" onClick={() => setPaused((p) => !p)}>{paused ? "▶ Resume" : "⏸ Pause"}</button>
          <button className="pp-chip" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>⛶ Fullscreen</button>
        </footer>
      </div>
    </BrandShell>
  );
}
