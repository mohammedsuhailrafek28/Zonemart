"use client";
import Link from "next/link";
import { useApp } from "./app-provider";

export function Header() {
  const { session, profile, loading, cartCount, signOut } = useApp();
  return <header className="site-header"><nav className="container nav" aria-label="Main navigation">
    <Link href="/" className="brand"><span className="brand-mark" />ZoneMart</Link>
    <div className="nav-links">
      {profile?.role === "customer" && <><Link href="/shop">Shop</Link><Link href="/flash-requests">Flash Requests</Link><Link href="/orders">Orders</Link><Link href="/cart">Cart ({cartCount})</Link></>}
      {profile?.role === "vendor" && <Link href="/vendor">Vendor dashboard</Link>}
      {!loading && !session && <><Link href="/#how-it-works">How it works</Link><Link href="/flash-requests/new">Flash Requests</Link><Link href="/#for-merchants">For merchants</Link><Link href="/login">Sign in</Link><Link className="button small" href="/shop">Search nearby</Link></>}
      {session && <button className="button secondary small" onClick={() => void signOut()}>Sign out</button>}
    </div>
    <div className="mobile-nav">
      {profile?.role === "customer" && <><Link href="/shop">Shop</Link><Link href="/cart">Cart ({cartCount})</Link></>}
      {profile?.role === "vendor" && <Link href="/vendor">Dashboard</Link>}
      {!loading && !session && <><Link href="/login">Sign in</Link><Link className="button small" href="/shop">Search</Link></>}
      {session && <button className="button secondary small" onClick={() => void signOut()}>Sign out</button>}
    </div>
  </nav></header>;
}
