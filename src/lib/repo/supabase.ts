"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Repo, NewEventInput } from "./types";
import type { ClubBrand, Cursor, EventMeta } from "../types";
import type { Entry, EventConfig, Level, Match, MatchResult, Results } from "../engine";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function supabaseClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const toClub = (r: Row): ClubBrand => ({
  id: r.id, slug: r.slug, name: r.name, logoUrl: r.logo_url, colorPrimary: r.color_primary, colorBg: r.color_bg,
});
const toEvent = (r: Row): EventMeta => ({ id: r.id, slug: r.slug, name: r.name, status: r.status, config: r.config as EventConfig });
const ms = (t: string | null) => (t ? new Date(t).getTime() : undefined);

export function makeSupabaseRepo(): Repo {
  const sb = supabaseClient();
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };
  let clubCache: ClubBrand | null = null;

  return {
    mode: "supabase",
    async getClub() {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await sb.from("club_members").select("clubs(*)").eq("user_id", u.user.id).limit(1);
      fail(error);
      const row = (data?.[0] as Row | undefined)?.clubs;
      clubCache = row ? toClub(row) : null;
      return clubCache;
    },
    async createClub(name, slug) {
      const { data, error } = await sb.rpc("create_club", { p_name: name, p_slug: slug });
      fail(error);
      clubCache = toClub(data as Row);
      return clubCache;
    },
    async updateClub(patch) {
      const c = clubCache ?? (await this.getClub());
      if (!c) throw new Error("No club");
      const upd: Row = {};
      if (patch.name !== undefined) upd.name = patch.name;
      if (patch.logoUrl !== undefined) upd.logo_url = patch.logoUrl;
      if (patch.colorPrimary !== undefined) upd.color_primary = patch.colorPrimary;
      if (patch.colorBg !== undefined) upd.color_bg = patch.colorBg;
      const { data, error } = await sb.from("clubs").update(upd).eq("id", c.id).select().single();
      fail(error);
      clubCache = toClub(data as Row);
      return clubCache;
    },
    async uploadLogo(file, key) {
      const c = clubCache ?? (await this.getClub());
      if (!c) throw new Error("No club");
      const path = `${c.id}/${key}-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await sb.storage.from("branding").upload(path, file, { upsert: true });
      fail(error);
      return sb.storage.from("branding").getPublicUrl(path).data.publicUrl;
    },
    async listEvents() {
      const c = clubCache ?? (await this.getClub());
      if (!c) return [];
      const { data, error } = await sb.from("events").select("*").eq("club_id", c.id).order("created_at", { ascending: false });
      fail(error);
      return (data ?? []).map(toEvent);
    },
    async createEvent(input: NewEventInput) {
      const c = clubCache ?? (await this.getClub());
      if (!c) throw new Error("No club");
      const { data: ev, error } = await sb
        .from("events")
        .insert({ club_id: c.id, slug: input.slug, name: input.name, status: "live", config: input.config })
        .select()
        .single();
      fail(error);
      const eventId = (ev as Row).id as string;
      // entries get their real uuids from the client so matches can point at them
      const e1 = await sb.from("entries").insert(
        input.entries.map((e, i) => ({ id: e.id, event_id: eventId, name: e.name, level: e.level, logo_url: e.logoUrl ?? null, color: e.color ?? null, sort: i })),
      );
      fail(e1.error);
      const pl = input.entries.flatMap((e) => e.players.map((p) => ({ id: p.id, event_id: eventId, entry_id: e.id, name: p.name, gender: p.gender ?? null })));
      if (pl.length) fail((await sb.from("players").insert(pl)).error);
      const codes = input.matches.map((m) => ({
        event_id: eventId, code: m.id, n: m.n, pool_id: m.poolId, level: m.level, category: m.category,
        entry_a: m.a, entry_b: m.b, slot: m.slot, court: m.court,
      }));
      fail((await sb.from("matches").insert(codes)).error);
      return toEvent(ev as Row);
    },
    async setStatus(eventId, status) {
      fail((await sb.from("events").update({ status }).eq("id", eventId)).error);
    },
    async loadBundle(clubSlug, eventSlug) {
      const { data: club } = await sb.from("clubs").select("*").eq("slug", clubSlug).maybeSingle();
      if (!club) return null;
      const { data: ev } = await sb.from("events").select("*").eq("club_id", club.id).eq("slug", eventSlug).maybeSingle();
      if (!ev) return null;
      const [en, pl, ma, re, cu] = await Promise.all([
        sb.from("entries").select("*").eq("event_id", ev.id).order("sort"),
        sb.from("players").select("*").eq("event_id", ev.id),
        sb.from("matches").select("*").eq("event_id", ev.id).order("n"),
        sb.from("results").select("*").eq("event_id", ev.id),
        sb.from("court_cursors").select("*").eq("event_id", ev.id),
      ]);
      const entries: Entry[] = (en.data ?? []).map((e: Row) => ({
        id: e.id, name: e.name, level: e.level as Level, logoUrl: e.logo_url, color: e.color,
        players: (pl.data ?? []).filter((p: Row) => p.entry_id === e.id).map((p: Row) => ({ id: p.id, name: p.name, gender: p.gender ?? undefined })),
      }));
      const idByUuid = new Map<string, string>();
      const matches: Match[] = (ma.data ?? []).map((m: Row) => {
        idByUuid.set(m.id, m.code);
        return { id: m.code, n: m.n, poolId: m.pool_id, level: m.level, category: m.category, a: m.entry_a, b: m.entry_b, slot: m.slot, court: m.court };
      });
      const results: Results = {};
      for (const r of re.data ?? []) {
        const code = idByUuid.get(r.match_id);
        if (!code) continue;
        const res: MatchResult = {
          a: r.score_a, b: r.score_b, final: r.final, pa: r.players_a, pb: r.players_b,
          entryA: r.entry_a ?? undefined, entryB: r.entry_b ?? undefined,
          startedAt: ms(r.started_at), endedAt: ms(r.ended_at),
        };
        results[code] = res;
      }
      const cursors: Record<number, Cursor> = {};
      for (const c of cu.data ?? []) cursors[c.court] = { slot: c.slot, startedAt: ms(c.started_at) };
      return { club: toClub(club), event: toEvent(ev), entries, matches, results, cursors };
    },
    subscribe(eventId, reload) {
      let t: ReturnType<typeof setTimeout> | undefined;
      const kick = () => {
        clearTimeout(t);
        t = setTimeout(reload, 250);
      };
      const ch = sb
        .channel(`event-${eventId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "results", filter: `event_id=eq.${eventId}` }, kick)
        .on("postgres_changes", { event: "*", schema: "public", table: "court_cursors", filter: `event_id=eq.${eventId}` }, kick)
        .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `event_id=eq.${eventId}` }, kick)
        .subscribe();
      return () => {
        clearTimeout(t);
        sb.removeChannel(ch);
      };
    },
    async saveResult(b, matchId, r) {
      const uuid = await matchUuid(sb, b.event.id, matchId);
      if (!r) {
        fail((await sb.from("results").delete().eq("match_id", uuid)).error);
        return;
      }
      fail(
        (
          await sb.from("results").upsert({
            match_id: uuid, event_id: b.event.id, score_a: r.a, score_b: r.b, final: r.final,
            players_a: r.pa ?? [], players_b: r.pb ?? [], entry_a: r.entryA ?? null, entry_b: r.entryB ?? null,
            started_at: r.startedAt ? new Date(r.startedAt).toISOString() : null,
            ended_at: r.endedAt ? new Date(r.endedAt).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
        ).error,
      );
    },
    async setCursor(b, court, c) {
      fail(
        (
          await sb.from("court_cursors").upsert({
            event_id: b.event.id, court, slot: c.slot,
            started_at: c.startedAt ? new Date(c.startedAt).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
        ).error,
      );
    },
  };
}

const uuidCache = new Map<string, string>();
async function matchUuid(sb: ReturnType<typeof supabaseClient>, eventId: string, code: string) {
  const k = `${eventId}:${code}`;
  const hit = uuidCache.get(k);
  if (hit) return hit;
  const { data, error } = await sb.from("matches").select("id").eq("event_id", eventId).eq("code", code).single();
  if (error || !data) throw new Error(error?.message ?? "Match not found");
  uuidCache.set(k, data.id as string);
  return data.id as string;
}
