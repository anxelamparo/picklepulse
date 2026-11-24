"use client";
import type { Repo } from "./types";
import { makeLocalRepo } from "./local";
import { makeSupabaseRepo } from "./supabase";

let repo: Repo | null = null;
export const hasSupabase = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** Supabase when the env vars exist, otherwise the in-browser demo backend. */
export function getRepo(): Repo {
  if (!repo) repo = hasSupabase() ? makeSupabaseRepo() : makeLocalRepo();
  return repo;
}
export type { Repo, NewEventInput } from "./types";
