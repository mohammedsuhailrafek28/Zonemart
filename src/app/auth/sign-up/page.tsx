"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const zones = ["Anna Nagar", "T Nagar", "Velachery"];
function SignUpForm() {
  const search = useSearchParams();
  const router = useRouter();
  const intent = search.get("intent") === "vendor" ? "vendor" : "customer";
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget); const supabase = createClient();
    const fullName = String(form.get("fullName"));
    const zone = String(form.get("zone"));
    const { data, error: authError } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { data: { full_name: fullName, role: intent, zone } },
    });
    if (authError) { setError(authError.message); setBusy(false); return; }
    if (!data.session) { setMessage("Check your email to confirm your account, then sign in."); setBusy(false); return; }
    const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, role: intent, zone }) });
    if (!response.ok) { const body = await response.json(); setError(body.error?.message || "Could not create your profile."); setBusy(false); return; }
    router.replace(intent === "vendor" ? "/vendor-coming-soon" : "/shop"); router.refresh();
  }
  return <div className="auth-shell"><section className="card auth-card"><span className="eyebrow">{intent === "vendor" ? "Merchant onboarding" : "Customer account"}</span><h2>Create your ZoneMart account</h2>
    <form className="form" onSubmit={submit}>
      {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
      <div className="field"><label htmlFor="fullName">Full name</label><input className="input" id="fullName" name="fullName" required minLength={2} /></div>
      <div className="field"><label htmlFor="zone">Your zone</label><select className="input" id="zone" name="zone">{zones.map(zone => <option key={zone}>{zone}</option>)}</select></div>
      <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={6} /></div>
      <button className="button" disabled={busy}>{busy ? "Creating account…" : intent === "vendor" ? "Create vendor account" : "Create customer account"}</button>
    </form><p className="muted">Already registered? <Link href="/auth/sign-in" style={{ color: "var(--green)", fontWeight: 800 }}>Sign in</Link></p>
  </section></div>;
}

export default function SignUpPage() {
  return <Suspense fallback={<div className="auth-shell"><div className="card auth-card skeleton" /></div>}><SignUpForm /></Suspense>;
}
