"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { api, displayError } from "@/lib/client-api";
import type { FlashRequest } from "@/lib/ui-models";

const categories = ["Electronics", "Stationery", "Project Materials", "Repair Essentials"];
function NewFlashRequestForm() {
  const search = useSearchParams(); const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const data = await api<FlashRequest>("/api/flash-requests", { method: "POST", body: JSON.stringify({
        itemName: String(form.get("itemName")), description: String(form.get("description")) || undefined,
        category: String(form.get("category")), quantity: Number(form.get("quantity")),
        maxPrice: form.get("maxPrice") ? Number(form.get("maxPrice")) : null, urgencyMinutes: Number(form.get("urgencyMinutes")),
      }) });
      router.push(`/flash-requests/${data.id}`);
    } catch (e) { setError(displayError(e)); setBusy(false); }
  }
  return <CustomerGuard><div className="container page"><div className="page-head"><div><span className="eyebrow">Ask your zone</span><h2>Create a Flash Request</h2><p className="muted">Share only what merchants need to make a useful offer.</p></div></div>
    <form className="card form" style={{ maxWidth: 720 }} onSubmit={submit}>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="itemName">Product name</label><input className="input" id="itemName" name="itemName" defaultValue={search.get("item") || ""} required minLength={2} maxLength={160} /></div>
      <div className="field"><label htmlFor="description">Description (optional)</label><textarea className="input" id="description" name="description" maxLength={1000} placeholder="Specifications, brand preference, or compatibility details" /></div>
      <div className="form-grid"><div className="field"><label htmlFor="category">Category</label><select className="input" id="category" name="category">{categories.map(c => <option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="quantity">Quantity</label><input className="input" id="quantity" name="quantity" type="number" min="1" max="999" defaultValue="1" required /></div></div>
      <div className="form-grid"><div className="field"><label htmlFor="maxPrice">Maximum total price (optional)</label><input className="input" id="maxPrice" name="maxPrice" type="number" min="0" step=".01" /></div><div className="field"><label htmlFor="urgencyMinutes">Keep request open</label><select className="input" id="urgencyMinutes" name="urgencyMinutes" defaultValue="60"><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="120">2 hours</option></select></div></div>
      <div className="notice">Your profile zone is applied securely by the server. Merchants do not receive private contact details.</div><button className="button" disabled={busy}>{busy ? "Creating request…" : "Send to nearby merchants"}</button>
    </form>
  </div></CustomerGuard>;
}

export default function NewFlashRequestPage() {
  return <Suspense fallback={<div className="container page"><div className="skeleton" /></div>}><NewFlashRequestForm /></Suspense>;
}
