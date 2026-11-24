"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandShell } from "@/components/Brand";

export default function Callback() {
  const router = useRouter();
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const { supabaseClient } = await import("@/lib/repo/supabase");
      const sb = supabaseClient();
      const code = new URLSearchParams(location.search).get("code");
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return setErr(error.message);
      }
      router.replace("/app");
    })();
  }, [router]);
  return <BrandShell><p className="p-8">{err || "Signing you in…"}</p></BrandShell>;
}
