"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { useApp } from "@/components/app-provider";
import { ProductCard } from "@/components/product-card";
import { ReservationConfirmation } from "@/components/reservation-confirmation";
import { api, displayError } from "@/lib/client-api";
import type { Product, Reservation } from "@/lib/ui-models";

const categories = ["", "Electronics", "Stationery", "Project Materials", "Repair Essentials"];
const zones = ["", "Anna Nagar", "T Nagar", "Velachery"];
export default function ShopPage() {
  const { profile } = useApp();
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [zone, setZone] = useState("");
  const [reservation, setReservation] = useState<(Reservation & { product: Product }) | null>(null);
  const requestSequence = useRef(0);
  const load = useCallback(async (q = query) => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError("");
    const params = new URLSearchParams(); if (q) params.set("q", q); if (category) params.set("category", category); if (zone) params.set("zone", zone);
    try {
      const data = await api<{ products: Product[] }>(`/api/products?${params}`);
      if (sequence === requestSequence.current) setProducts(data.products);
    } catch (e) {
      if (sequence === requestSequence.current) setError(displayError(e));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [category, query, zone]);
  useEffect(() => {
    if (profile?.role === "customer") void load();
  }, [category, profile?.role, zone]); // eslint-disable-line react-hooks/exhaustive-deps
  function submit(event: FormEvent) { event.preventDefault(); void load(); }
  return <CustomerGuard><div className="container page">
    {reservation ? <ReservationConfirmation reservation={reservation} /> : <>
      <div className="page-head"><div><span className="eyebrow">Marketplace</span><h2>What do you need nearby?</h2><p className="muted">Only active catalogue items and current stock are shown.</p></div><Link className="button secondary" href="/flash-requests/new">Create Flash Request</Link></div>
      <form className="toolbar" onSubmit={submit}>
        <div className="field"><label htmlFor="search">Search products</label><input className="input" id="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try “charger” or “chart paper”" /></div>
        <div className="field"><label htmlFor="category">Category</label><select className="input" id="category" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(v => <option key={v} value={v}>{v || "All categories"}</option>)}</select></div>
        <div className="field"><label htmlFor="zone">Zone</label><select className="input" id="zone" value={zone} onChange={e => setZone(e.target.value)}>{zones.map(v => <option key={v} value={v}>{v || "All zones"}</option>)}</select></div>
      </form>
      {error && <div className="error" role="alert">{error}<button className="button secondary small" style={{ marginLeft: 12 }} onClick={() => void load()}>Try again</button></div>}
      {loading ? <div className="products" aria-label="Loading products">{[1,2,3].map(i => <div className="skeleton" key={i} />)}</div> :
       products.length ? <div className="products">{products.map(product => <ProductCard key={product.id} product={product} onReserved={setReservation} />)}</div> :
       <div className="flash-recovery"><span className="eyebrow">Search recovery</span><h2>Can’t find it nearby?</h2><p className="muted">Create a Flash Request and let eligible merchants in your zone respond with real offers.</p><Link className="button" href={`/flash-requests/new${query ? `?item=${encodeURIComponent(query)}` : ""}`}>Create a Flash Request</Link></div>}
    </>}
  </div></CustomerGuard>;
}
