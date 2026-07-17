"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { api, displayError, money } from "@/lib/client-api";
import type { FlashRequest } from "@/lib/ui-models";

export default function FlashRequestsPage() {
  const [requests, setRequests] = useState<FlashRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { api<{ requests: FlashRequest[] }>("/api/flash-requests").then(d => setRequests(d.requests)).catch(e => setError(displayError(e))).finally(() => setLoading(false)); }, []);
  return <CustomerGuard><div className="container page"><div className="page-head"><div><span className="eyebrow">Search recovery</span><h2>My Flash Requests</h2><p className="muted">Nearby eligible merchants can respond while a request is open.</p></div><Link className="button" href="/flash-requests/new">New Flash Request</Link></div>
    {error && <div className="error" role="alert">{error}</div>}
    {loading ? <div className="skeleton" /> : !requests.length ? <div className="empty"><h2>No requests yet</h2><p className="muted">When a catalogue search fails, describe the item and ask your zone.</p><Link className="button" href="/flash-requests/new">Create a request</Link></div> :
      <div className="grid-3">{requests.map(request => <Link className="card" href={`/flash-requests/${request.id}`} key={request.id}><span className={`badge ${request.status === "open" ? "warning" : ""}`}>{request.status}</span><h3 style={{ marginTop: 14 }}>{request.item_name}</h3><p className="muted">{request.quantity} needed · {request.zone}</p>{request.max_price != null && <strong>Up to {money(request.max_price)}</strong>}<p className="muted" style={{ fontSize: ".8rem" }}>Expires {new Date(request.expires_at).toLocaleString("en-IN")}</p></Link>)}</div>}
  </div></CustomerGuard>;
}
