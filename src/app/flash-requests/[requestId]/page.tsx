"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { Countdown } from "@/components/countdown";
import { ReservationConfirmation } from "@/components/reservation-confirmation";
import { api, displayError, money } from "@/lib/client-api";
import type { FlashRequest, Reservation } from "@/lib/ui-models";

export default function FlashRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>(); const [request, setRequest] = useState<FlashRequest | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [reservation, setReservation] = useState<Reservation | null>(null);
  const load = useCallback(async () => { try { setRequest(await api<FlashRequest>(`/api/flash-requests/${requestId}`)); } catch (e) { setError(displayError(e)); } finally { setLoading(false); } }, [requestId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (request?.status !== "open") return;
    const id = window.setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => window.clearInterval(id);
  }, [load, request?.status]);
  async function accept(offerId: string) { setError(""); try { setReservation(await api<Reservation>(`/api/flash-requests/${requestId}/offers/${offerId}/accept`, { method: "POST" })); } catch (e) { setError(displayError(e)); } }
  async function cancel() { if (!window.confirm("Cancel this open Flash Request?")) return; try { await api(`/api/flash-requests/${requestId}`, { method: "DELETE" }); await load(); } catch (e) { setError(displayError(e)); } }
  return <CustomerGuard><div className="container page">{reservation ? <ReservationConfirmation reservation={reservation} title="Offer accepted and reserved" /> : loading ? <div className="skeleton" /> : !request ? <div className="error">{error || "Request not found."}</div> : <>
    <div className="page-head"><div><span className="eyebrow">Flash Request · {request.zone}</span><h2>{request.item_name}</h2><p className="muted">{request.quantity} needed · {request.category}</p></div><span className={`badge ${request.status === "open" ? "warning" : ""}`}>{request.status}</span></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="order-layout"><section><div className="card" style={{ marginBottom: 20 }}><h3>Request details</h3>{request.description && <p>{request.description}</p>}<div className="summary-line"><span>Maximum price</span><strong>{request.max_price == null ? "Not set" : money(request.max_price)}</strong></div><div className="summary-line"><span>Request window</span><Countdown expiresAt={request.expires_at} /></div>{request.status === "open" && <button className="button danger small" onClick={() => void cancel()}>Cancel request</button>}</div>
      <h2>Merchant offers</h2>{!request.offers?.length ? <div className="empty"><h3>No offers yet</h3><p className="muted">Eligible merchants in your zone can respond while this request remains open. This page refreshes quietly.</p></div> :
        request.offers.map(offer => <article className="card offer" key={offer.id}><div><div className="store"><span className="store-icon">{offer.store.name[0]}</span>{offer.store.name} · {offer.store.zone}</div><span className="badge">{offer.status}</span><h3 style={{ marginTop: 10 }}>{offer.product_name}</h3><p className="muted">{offer.quantity} available · ready in about {offer.ready_minutes} minutes</p>{offer.note && <p>{offer.note}</p>}</div><div><div className="price">{money(Number(offer.price) * Math.min(request.quantity, offer.quantity))}</div><div className="muted">{money(offer.price)} each</div>{request.status === "open" && offer.status === "open" && <button className="button" style={{ marginTop: 14 }} onClick={() => void accept(offer.id)}>Accept offer</button>}</div></article>)}
    </section><aside className="card summary"><h3>How acceptance works</h3><p className="muted">The database locks this request and its offers. Exactly one offer can win, and your 30-minute pickup reservation is created atomically.</p><Link className="button secondary" href="/flash-requests">All requests</Link></aside></div>
  </>}</div></CustomerGuard>;
}
