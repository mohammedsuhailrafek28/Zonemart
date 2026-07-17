"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { ReservationConfirmation } from "@/components/reservation-confirmation";
import { useApp } from "@/components/app-provider";
import { api, displayError, money } from "@/lib/client-api";
import type { CartItem, Reservation } from "@/lib/ui-models";

export default function CartPage() {
  const { refreshCart } = useApp(); const [items, setItems] = useState<CartItem[]>([]); const [store, setStore] = useState<{ name: string } | null>(null);
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [reservation, setReservation] = useState<Reservation | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const data = await api<{ items: CartItem[]; store: { name: string } | null; total: number }>("/api/cart"); setItems(data.items); setStore(data.store); setTotal(data.total); } catch (e) { setError(displayError(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function quantity(item: CartItem, next: number) { if (next < 1 || next > item.stock) return; try { await api(`/api/cart/${item.productId}`, { method: "PATCH", body: JSON.stringify({ quantity: next }) }); await load(); await refreshCart(); } catch (e) { setError(displayError(e)); } }
  async function remove(id: string) { await api(`/api/cart/${id}`, { method: "DELETE" }); await load(); await refreshCart(); }
  async function clear() { await api("/api/cart", { method: "DELETE" }); await load(); await refreshCart(); }
  async function checkout() { setError(""); try { const result = await api<Reservation>("/api/checkout", { method: "POST" }); setReservation(result); await refreshCart(); } catch (e) { setError(displayError(e)); } }
  return <CustomerGuard><div className="container page">{reservation ? <ReservationConfirmation reservation={reservation} /> : <>
    <div className="page-head"><div><span className="eyebrow">Single-store cart</span><h2>Your cart</h2></div>{items.length > 0 && <button className="button danger small" onClick={() => void clear()}>Clear cart</button>}</div>
    {error && <div className="error" role="alert">{error}</div>}
    {loading ? <div className="skeleton" /> : !items.length ? <div className="empty"><h2>Your cart is empty</h2><p className="muted">Add products from one store, then reserve them together.</p><a className="button" href="/shop">Browse nearby products</a></div> :
      <div className="cart-layout"><section className="card">{items.map(item => <div className="cart-row" key={item.productId}><div><h3>{item.name}</h3><span className="muted">{money(item.price)} · {item.store.name}</span></div><div className="qty" aria-label={`Quantity for ${item.name}`}><button aria-label="Decrease quantity" onClick={() => void quantity(item, item.quantity - 1)}>−</button><span>{item.quantity}</span><button aria-label="Increase quantity" disabled={item.quantity >= item.stock} onClick={() => void quantity(item, item.quantity + 1)}>+</button></div><div><strong>{money(item.lineTotal)}</strong><br /><button className="button danger small" onClick={() => void remove(item.productId)}>Remove</button></div></div>)}</section>
      <aside className="card summary"><h3>Reservation summary</h3><p className="muted">{store?.name}</p><div className="summary-line"><span>{items.reduce((n, i) => n + i.quantity, 0)} items</span><span>{money(total)}</span></div><div className="summary-line total"><span>Total</span><span>{money(total)}</span></div><p className="notice">Stock is deducted only after atomic checkout succeeds. Your pickup hold lasts 30 minutes.</p><button className="button" style={{ width: "100%" }} onClick={() => void checkout()}>Checkout and reserve</button></aside></div>}
  </>}</div></CustomerGuard>;
}
