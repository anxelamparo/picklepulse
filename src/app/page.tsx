import Link from "next/link";
import { BrandShell } from "@/components/Brand";

const FEATURES = [
  ["Round robin, done for you", "Pick teams or doubles, skill levels and courts. PicklePulse builds a conflict-free schedule in seconds."],
  ["Live standings & court boards", "Players and fans follow scores on their phones. No login needed to watch."],
  ["TV mode", "One tap turns any screen into a rotating Standings / Live Courts / Upcoming display."],
  ["Your club's brand", "Upload your logo, choose your colors. Every page looks like your event."],
  ["Per-court control", "Each court advances on its own, with a game timer and automatic next game."],
  ["Teams, pairs & levels", "Novice to Advanced, separate groups or one pool, MD / WD / XD team matches."],
];

export default function Home() {
  return (
    <BrandShell>
      <main className="mx-auto max-w-5xl px-5 py-14">
        <div className="pp-display text-5xl sm:text-7xl">
          Pickle<span style={{ color: "var(--brand)" }}>Pulse</span>
        </div>
        <p className="mt-4 max-w-2xl text-lg" style={{ color: "var(--mut)" }}>
          Run pickleball round robins with live scores, court boards and TV mode — branded for your club.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app" className="pp-btn brand">Open dashboard</Link>
          <Link href="/login" className="pp-btn">Sign in</Link>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="pp-brandcard p-4">
              <div className="pp-display text-xl" style={{ color: "var(--brand)" }}>{t}</div>
              <p className="mt-1 text-sm" style={{ color: "var(--mut)" }}>{d}</p>
            </div>
          ))}
        </div>
      </main>
    </BrandShell>
  );
}
