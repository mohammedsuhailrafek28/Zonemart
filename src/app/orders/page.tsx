"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { Countdown } from "@/components/countdown";
import { StatusBadge } from "@/components/status-badge";
import { api, displayError, money } from "@/lib/client-api";

interface Order { id: string; status: string; total: number | string; pickup_code: string; ready_at: string | null; created_at: string; expires_at: string; flash_request_id: string | null; store: { name: string }; items: { id: string; product_name: string; quantity: number; unit_price: number | string }[] }
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); try { const data = await api<{ orders: Order[] }>("/api/orders"); setOrders(data.orders); } catch (e) { setError(displayError(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function cancel(id: string) { if (!window.confirm("Cancel this reservation and release its stock?")) return; try { await api(`/api/orders/${id}/cancel`, { method: "POST" }); await load(); } catch (e) { setError(displayError(e)); } }
  return <CustomerGuard><div className="container page"><div className="page-head"><div><span className="eyebrow">Pickup reservations</span><h2>My orders</h2><p className="muted">Listed products and accepted Flash offers appear together.</p></div></div>
    {error && <div className="error" role="alert">{error}</div>}
    {loading ? <div className="skeleton" /> : !orders.length ? <div className="empty"><h2>No orders yet</h2><p className="muted">Reserve a nearby product or accept a merchant offer.</p><a className="button" href="/shop">Start shopping</a></div> :
      orders.map(order => <article className="card order-card" key={order.id}><div className="order-top"><div><StatusBadge status={order.status} readyAt={order.ready_at} /><h3 style={{ marginTop: 10 }}>{order.store.name}</h3><span className="muted">{order.flash_request_id ? "Flash Request order" : "Listed product order"} · {new Date(order.created_at).toLocaleString("en-IN")}</span></div><strong className="price">{money(order.total)}</strong></div>
        {order.items.map(item => <div className="summary-line" key={item.id}><span>{item.quantity} × {item.product_name}</span><span>{money(Number(item.unit_price) * item.quantity)}</span></div>)}
        {(order.status === "reserved") && <div className="pickup" style={{ marginTop: 16 }}><div className="muted">Pickup code — visible only to you</div><div className="pickup-code">{order.pickup_code}</div>{!order.ready_at && <Countdown expiresAt={order.expires_at} />}{order.ready_at && <strong style={{ color: "var(--green)" }}>Ready for pickup</strong>}</div>}
        {order.status === "reserved" && <div className="actions"><button className="button danger small" onClick={() => void cancel(order.id)}>Cancel reservation</button></div>}
      </article>)}
  </div></CustomerGuard>;
}
