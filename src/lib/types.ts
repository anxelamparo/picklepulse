import type { Entry, EventConfig, Match, Results } from "./engine";

export interface ClubBrand {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  colorPrimary: string;
  colorBg: string;
}

export interface EventMeta {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "live" | "finished";
  config: EventConfig;
}

/** The ongoing game of one court. */
export interface Cursor {
  slot: number;
  startedAt?: number | null;
}

export interface EventBundle {
  club: ClubBrand;
  event: EventMeta;
  entries: Entry[];
  matches: Match[];
  results: Results;
  cursors: Record<number, Cursor>;
}

export const DEFAULT_BRAND = { colorPrimary: "#c6ff1a", colorBg: "#0b1220" };
