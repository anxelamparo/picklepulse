"use client";
import { useState } from "react";
import Link from "next/link";
import { BrandShell } from "@/components/Brand";
import { hasSupabase } from "@/lib/repo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  if (!hasSupabase())
    return (
      <BrandShell>
        <div className="mx-auto max-w-md space-y-3 p-8 text-center">
          <p>Demo mode needs no login.</p>
          <Link href="/app" className="pp-btn brand inline-block">Open the dashboard</Link>
        </div>
      </BrandShell>
    );
  return (
    <BrandShell>
      <div className="mx-auto max-w-md space-y-3 p-8">
        <h1 className="pp-display text-3xl">Sign in</h1>
        {sent ? (
          <p>Check your email for the sign-in link.</p>
        ) : (
          <>
            <label className="pp-label">Email</label>
            <input className="pp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@club.com" />
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button className="pp-btn brand w-full" disabled={!email.includes("@")} onClick={async () => {
              const { supabaseClient } = await import("@/lib/repo/supabase");
              const { error } = await supabaseClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
              if (error) setErr(error.message); else setSent(true);
            }}>Email me a sign-in link</button>
          </>
        )}
      </div>
    </BrandShell>
  );
}
