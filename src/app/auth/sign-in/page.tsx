"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (authError) { setError("Email or password is incorrect."); setBusy(false); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    router.replace(profile?.role === "vendor" ? "/vendor-coming-soon" : search.get("next") || "/shop");
    router.refresh();
  }
  return <div className="auth-shell"><section className="card auth-card"><span className="eyebrow">Welcome back</span><h2>Sign in to ZoneMart</h2><p className="muted">Access your cart, reservations and Flash Requests.</p>
    <form className="form" onSubmit={submit}>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required minLength={6} /></div>
      <button className="button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <p className="muted">New here? <Link href="/auth/sign-up" style={{ color: "var(--green)", fontWeight: 800 }}>Create an account</Link></p>
  </section></div>;
}

export default function SignInPage() {
  return <Suspense fallback={<div className="auth-shell"><div className="card auth-card skeleton" /></div>}><SignInForm /></Suspense>;
}
