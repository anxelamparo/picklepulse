"use client";
import type { Repo, NewEventInput } from "./types";
import type { ClubBrand, EventBundle, EventMeta, Cursor } from "../types";
import { DEFAULT_BRAND } from "../types";
import type { Entry, Match, MatchResult, Results } from "../engine";

/** Demo backend: everything lives in this browser (localStorage). Tabs of the same browser stay in sync. */
interface Stored {
  club: ClubBrand | null;
  events: { meta: EventMeta; entries: Entry[]; matches: Match[]; results: Results; cursors: Record<number, Cursor> }[];
}
const KEY = "picklepulse_local_v1";
const read = (): Stored => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "") as Stored;
  } catch {
    return { club: null, events: [] };
  }
};
const write = (s: Stored) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  bc?.postMessage("change");
};
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("picklepulse") : null;

export function makeLocalRepo(): Repo {
  return {
    mode: "local",
    async getClub() {
      return read().club;
    },
    async createClub(name, slug) {
      const s = read();
      s.club = { id: "local-club", slug, name, logoUrl: null, ...DEFAULT_BRAND };
      write(s);
      return s.club;
    },
    async updateClub(patch) {
      const s = read();
      if (!s.club) throw new Error("No club");
      s.club = { ...s.club, ...patch };
      write(s);
      return s.club;
    },
    async uploadLogo(file) {
      // demo mode keeps logos as data URLs inside localStorage, so keep them small
      return await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });
    },
    async listEvents() {
      return read().events.map((e) => e.meta);
    },
    async createEvent(input: NewEventInput) {
      const s = read();
      const meta: EventMeta = { id: crypto.randomUUID(), slug: input.slug, name: input.name, status: "live", config: input.config };
      s.events.push({ meta, entries: input.entries, matches: input.matches, results: {}, cursors: {} });
      write(s);
      return meta;
    },
    async setStatus(eventId, status) {
      const s = read();
      const e = s.events.find((x) => x.meta.id === eventId);
      if (e) e.meta.status = status;
      write(s);
    },
    async loadBundle(clubSlug, eventSlug) {
      const s = read();
      if (!s.club || s.club.slug !== clubSlug) return null;
      const e = s.events.find((x) => x.meta.slug === eventSlug);
      if (!e) return null;
      return { club: s.club, event: e.meta, entries: e.entries, matches: e.matches, results: e.results, cursors: e.cursors };
    },
    subscribe(_eventId, reload) {
      const on = () => reload();
      const onStorage = (ev: StorageEvent) => ev.key === KEY && reload();
      bc?.addEventListener("message", on);
      window.addEventListener("storage", onStorage);
      return () => {
        bc?.removeEventListener("message", on);
        window.removeEventListener("storage", onStorage);
      };
    },
    async saveResult(b: EventBundle, matchId: string, r: MatchResult | null) {
      const s = read();
      const e = s.events.find((x) => x.meta.id === b.event.id);
      if (!e) return;
      if (r) e.results[matchId] = r;
      else delete e.results[matchId];
      write(s);
    },
    async setCursor(b: EventBundle, court: number, c: Cursor) {
      const s = read();
      const e = s.events.find((x) => x.meta.id === b.event.id);
      if (!e) return;
      e.cursors[court] = c;
      write(s);
    },
  };
}
