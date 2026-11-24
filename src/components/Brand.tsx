"use client";
import type { CSSProperties, ReactNode } from "react";
import type { ClubBrand } from "@/lib/types";
import { DEFAULT_BRAND } from "@/lib/types";
import type { Entry } from "@/lib/engine";

export function BrandShell({ club, children, className = "" }: { club?: Pick<ClubBrand, "colorPrimary" | "colorBg"> | null; children: ReactNode; className?: string }) {
  const c = club ?? DEFAULT_BRAND;
  return (
    <div className={`pp-root ${className}`} style={{ "--brand": c.colorPrimary, "--bg": c.colorBg } as CSSProperties}>
      {children}
    </div>
  );
}

export function ClubMark({ club, size = 44 }: { club: Pick<ClubBrand, "name" | "logoUrl">; size?: number }) {
  return club.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={club.logoUrl} alt={club.name} style={{ height: size, width: "auto", maxWidth: size * 3 }} className="object-contain" />
  ) : (
    <span
      className="pp-display grid place-items-center rounded-full"
      style={{ width: size, height: size, background: "var(--brand)", color: "var(--ink)", fontSize: size * 0.45 }}
    >
      {club.name.slice(0, 2)}
    </span>
  );
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

export function EntryLogo({ entry, size = 40 }: { entry?: Pick<Entry, "name" | "logoUrl" | "color">; size?: number }) {
  if (!entry) return <span style={{ width: size, height: size }} />;
  return entry.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.logoUrl} alt={entry.name} style={{ width: size, height: size }} className="rounded-lg bg-white/90 object-contain" />
  ) : (
    <span
      className="pp-display grid shrink-0 place-items-center rounded-lg"
      style={{ width: size, height: size, background: entry.color ?? "#233461", fontSize: size * 0.36 }}
    >
      {initials(entry.name)}
    </span>
  );
}
