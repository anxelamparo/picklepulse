import type { ClubBrand, Cursor, EventBundle, EventMeta } from "../types";
import type { Entry, EventConfig, Match, MatchResult } from "../engine";

export interface NewEventInput {
  name: string;
  slug: string;
  config: EventConfig;
  entries: Entry[];
  matches: Match[];
}

/** One interface, two backends: browser storage (demo) and Supabase (real). */
export interface Repo {
  mode: "local" | "supabase";
  /** Signed-in club of the current user (null = needs to create one). */
  getClub(): Promise<ClubBrand | null>;
  createClub(name: string, slug: string): Promise<ClubBrand>;
  updateClub(patch: Partial<Pick<ClubBrand, "name" | "logoUrl" | "colorPrimary" | "colorBg">>): Promise<ClubBrand>;
  uploadLogo(file: File, key: string): Promise<string>;
  listEvents(): Promise<EventMeta[]>;
  createEvent(input: NewEventInput): Promise<EventMeta>;
  setStatus(eventId: string, status: EventMeta["status"]): Promise<void>;
  loadBundle(clubSlug: string, eventSlug: string): Promise<EventBundle | null>;
  /** Calls reload() whenever anything about the event changes. Returns an unsubscribe. */
  subscribe(eventId: string, reload: () => void): () => void;
  saveResult(b: EventBundle, matchId: string, r: MatchResult | null): Promise<void>;
  setCursor(b: EventBundle, court: number, c: Cursor): Promise<void>;
}
