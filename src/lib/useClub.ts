"use client";
import { useCallback, useEffect, useState } from "react";
import { getRepo, hasSupabase } from "./repo";
import type { ClubBrand } from "./types";

/** The signed-in organizer's club. In Supabase mode, signed-out visitors get `signedOut`. */
export function useClub() {
  const [club, setClub] = useState<ClubBrand | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const c = await getRepo().getClub();
      setClub(c);
      if (!c && hasSupabase()) {
        const { supabaseClient } = await import("./repo/supabase");
        const { data } = await supabaseClient().auth.getUser();
        setSignedOut(!data.user);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { club, loading, signedOut, refresh, setClub };
}
