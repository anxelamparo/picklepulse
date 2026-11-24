"use client";
import { useCallback, useEffect, useState } from "react";
import { getRepo } from "./repo";
import type { EventBundle } from "./types";

export function useBundle(clubSlug: string, eventSlug: string) {
  const [bundle, setBundle] = useState<EventBundle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const b = await getRepo().loadBundle(clubSlug, eventSlug);
      setBundle(b);
      setState(b ? "ready" : "missing");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }, [clubSlug, eventSlug]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const id = bundle?.event.id;
  useEffect(() => {
    if (!id) return;
    return getRepo().subscribe(id, () => void reload());
  }, [id, reload]);
  return { bundle, state, error, reload };
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
