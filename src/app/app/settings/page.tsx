"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { BrandShell, ClubMark } from "@/components/Brand";
import { useClub } from "@/lib/useClub";

const PRESETS = [
  { n: "Neon", p: "#c6ff1a", b: "#0b1220" },
  { n: "Ocean", p: "#38bdf8", b: "#06182b" },
  { n: "Sunset", p: "#fb923c", b: "#1a0d12" },
  { n: "Grape", p: "#c084fc", b: "#130b24" },
  { n: "Forest", p: "#4ade80", b: "#07170f" },
];

export default function Settings() {
  const { club, loading, setClub } = useClub();
  const [name, setName] = useState("");
  const [p, setP] = useState("#c6ff1a");
  const [bg, setBg] = useState("#0b1220");
  const [logo, setLogo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (club) { setName(club.name); setP(club.colorPrimary); setBg(club.colorBg); setLogo(club.logoUrl ?? null); }
  }, [club]);
  if (loading) return <BrandShell><p className="p-8">Loading…</p></BrandShell>;
  if (!club) return <BrandShell><p className="p-8">Create your club first. <Link className="underline" href="/app">Dashboard</Link></p></BrandShell>;
  const preview = { name, logoUrl: logo, colorPrimary: p, colorBg: bg };

  return (
    <BrandShell club={preview}>
      <div className="mx-auto max-w-3xl space-y-5 p-4">
        <Link href="/app" className="text-sm underline">← Dashboard</Link>
        <h1 className="pp-display text-3xl">Club branding</h1>
        <p className="text-sm" style={{ color: "var(--mut)" }}>Your logo, name and colors appear on the public live page, TV mode and the scorekeeper.</p>
        <div className="pp-card space-y-4 p-4">
          <div><label className="pp-label">Club name</label><input className="pp-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="flex items-center gap-3">
            <ClubMark club={preview} size={56} />
            <label className="pp-btn cursor-pointer">
              Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) { try { setLogo(await getRepo().uploadLogo(f, "club")); } catch (x) { setErr(x instanceof Error ? x.message : "Upload failed"); } }
              }} />
            </label>
            {logo && <button className="pp-btn" onClick={() => setLogo(null)}>Remove</button>}
          </div>
          <div>
            <label className="pp-label">Theme</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((t) => (
                <button key={t.n} className="pp-btn" onClick={() => { setP(t.p); setBg(t.b); }} style={{ borderLeft: `8px solid ${t.p}` }}>{t.n}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="pp-label">Accent color</label><input type="color" value={p} onChange={(e) => setP(e.target.value)} className="h-11 w-full rounded" /></div>
            <div><label className="pp-label">Background</label><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-11 w-full rounded" /></div>
          </div>
          <div className="pp-brandcard p-4">
            <div className="pp-display text-2xl" style={{ color: "var(--brand)" }}>Preview · Court 1</div>
            <div className="mt-1 text-sm">Your club&apos;s live board will look like this.</div>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button className="pp-btn brand" onClick={async () => {
            try {
              setClub(await getRepo().updateClub({ name: name.trim() || club.name, logoUrl: logo, colorPrimary: p, colorBg: bg }));
              setSaved(true); setTimeout(() => setSaved(false), 2500);
            } catch (x) { setErr(x instanceof Error ? x.message : "Could not save"); }
          }}>{saved ? "Saved ✔" : "Save branding"}</button>
        </div>
      </div>
    </BrandShell>
  );
}
