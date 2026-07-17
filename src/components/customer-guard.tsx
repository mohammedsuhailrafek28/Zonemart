"use client";
import Link from "next/link";
import { useApp } from "./app-provider";

export function CustomerGuard({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useApp();
  if (loading || (session && !profile)) return <div className="container page"><div className="skeleton" aria-label="Loading account" /></div>;
  if (!session) return <div className="container page empty"><h2>Sign in to continue</h2><p className="muted">Your cart, reservations and requests stay private to your account.</p><Link className="button" href="/auth/sign-in">Sign in</Link></div>;
  if (profile?.role !== "customer") return <div className="container page empty"><h2>Vendor workspace coming in B5B</h2><p className="muted">This area is reserved for customer accounts.</p></div>;
  return children;
}
