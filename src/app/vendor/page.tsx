"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, displayError, money } from "@/lib/client-api";
import { useApp } from "@/components/app-provider";

type Store = { id: string; name: string; zone: string; active: boolean; verified: boolean; category_tags: string[] };
type Product = { id: string; name: string; description: string; category: string; price: number; stock: number; image_url: string | null; active: boolean };
type Item = { product_name: string; quantity: number; unit_price: number };
type Order = { id: string; status: string; total: number; ready_at: string | null; expires_at: string; completed_at: string | null; flash_request_id: string | null; items: Item[] };
type Request = { id: string; item_name: string; description: string | null; category: string; quantity: number; zone: string; max_price: number | null; urgency_minutes: number; expires_at: string };
type Offer = { id: string; product_name: string; price: number; quantity: number; status: string; request: { item_name: string } };
type Tab = "overview" | "orders" | "inventory" | "requests";

export default function VendorDashboardPage() {
  const { profile } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [storeData, productData, orderData, requestData, offerData] = await Promise.all([
        api<Store>("/api/vendor/store"),
        api<{ products: Product[] }>("/api/vendor/products"),
        api<{ orders: Order[] }>("/api/vendor/orders?limit=50"),
        api<{ requests: Request[] }>("/api/vendor/flash-requests?limit=50"),
        api<{ offers: Offer[] }>("/api/vendor/offers"),
      ]);
      setStore(storeData); setProducts(productData.products); setOrders(orderData.orders);
      setRequests(requestData.requests); setOffers(offerData.offers);
    } catch (cause) { setError(displayError(cause)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submitOffer(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault(); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/vendor/flash-requests/${requestId}/offers`, { method: "POST", body: JSON.stringify({
        productName: String(data.get("productName")), quantityAvailable: Number(data.get("quantity")),
        unitPrice: Number(data.get("price")), note: String(data.get("note") || ""),
        readyMinutes: Number(data.get("readyMinutes")), expirationMinutes: 30,
      }) });
      setMessage("Offer submitted to the customer."); await load();
    } catch (cause) { setError(displayError(cause)); }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await api("/api/vendor/products", { method: "POST", body: JSON.stringify({
        name: String(data.get("name")), description: String(data.get("description")),
        category: String(data.get("category")), price: Number(data.get("price")),
        stock: Number(data.get("stock")), active: true,
      }) });
      event.currentTarget.reset(); setMessage("Product added to live inventory."); await load();
    } catch (cause) { setError(displayError(cause)); }
  }

  async function orderAction(order: Order, action: "ready" | "complete") {
    try {
      const pickupCode = action === "complete" ? window.prompt("Enter the customer’s 6-character pickup code") : null;
      if (action === "complete" && !pickupCode) return;
      await api(`/api/vendor/orders/${order.id}/${action}`, {
        method: "POST", body: action === "complete" ? JSON.stringify({ pickupCode }) : undefined,
      });
      setMessage(action === "ready" ? "Order marked ready." : "Pickup completed."); await load();
    } catch (cause) { setError(displayError(cause)); }
  }

  const reserved = orders.filter(order => order.status === "reserved");
  const completed = orders.filter(order => order.status === "completed");
  const grossSales = completed.reduce((sum, order) => sum + Number(order.total), 0);
  const lowStock = products.filter(product => product.active && product.stock <= 3);

  return <div className="ops-shell vendor-shell">
    <aside className="ops-sidebar"><span className="ops-brand">ZoneMart</span><small>Vendor Portal · {store?.zone || profile?.zone}</small>
      <nav>{(["overview", "orders", "inventory", "requests"] as Tab[]).map(value =>
        <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value === "requests" ? "Flash Requests" : value}</button>)}</nav>
      <button className="button" onClick={() => setTab("inventory")}>＋ Add product</button>
    </aside>
    <section className="ops-content">
      <header className="vendor-top"><div><b>{store?.name || "Vendor workspace"}</b><small>{store?.zone} · {store?.verified ? "Verified store" : "Store verification required"}</small></div><span>{profile?.full_name}</span></header>
      {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
      {loading ? <div className="skeleton" aria-label="Loading vendor workspace" /> : <>
        {tab === "overview" && <><span className="eyebrow">Live store operations</span><h1>Operational Overview</h1><p className="lead">Inventory, reservations and nearby customer demand from the existing ZoneMart APIs.</p>
          <div className="ops-metrics"><article><small>Completed sales</small><strong>{money(grossSales)}</strong></article><article><small>Active reservations</small><strong>{reserved.length}</strong></article><article><small>Completed pickups</small><strong>{completed.length}</strong></article><article className={lowStock.length ? "danger-metric" : ""}><small>Low stock</small><strong>{lowStock.length}</strong></article></div>
          <div className="vendor-grid"><OrderList orders={reserved.slice(0, 5)} onAction={orderAction} /><DemandRadar requests={requests.slice(0, 5)} onOffer={submitOffer} /></div>
        </>}
        {tab === "orders" && <><div className="page-head"><div><span className="eyebrow">Fulfilment</span><h2>Orders</h2></div></div><OrderList orders={orders} onAction={orderAction} /></>}
        {tab === "inventory" && <><div className="page-head"><div><span className="eyebrow">Catalogue</span><h2>Inventory</h2></div></div>
          <form className="card form vendor-product-form" onSubmit={createProduct}><h3>Add a real product</h3><div className="form-grid"><label className="field">Product name<input className="input" name="name" required minLength={2} /></label><label className="field">Category<select className="input" name="category">{["Electronics","Stationery","Project Materials","Repair Essentials"].map(v=><option key={v}>{v}</option>)}</select></label><label className="field">Price<input className="input" name="price" type="number" min="0" step=".01" required /></label><label className="field">Stock<input className="input" name="stock" type="number" min="0" required /></label></div><label className="field">Description<textarea className="input" name="description" /></label><button className="button">Add product</button></form>
          <div className="inventory-list">{products.map(product=><article className="card" key={product.id}><div><span className="badge">{product.category}</span><h3>{product.name}</h3><small className="muted">{product.active ? "Active" : "Inactive"}</small></div><div><strong>{money(product.price)}</strong><span className={product.stock <= 3 ? "badge danger" : "badge"}>{product.stock} in stock</span></div></article>)}</div>
        </>}
        {tab === "requests" && <><div className="page-head"><div><span className="eyebrow">Live Demand Radar</span><h2>Eligible Flash Requests</h2></div></div><DemandRadar requests={requests} onOffer={submitOffer} /><h3 style={{marginTop:32}}>Submitted offers</h3><div className="inventory-list">{offers.map(offer=><article className="card" key={offer.id}><div><h3>{offer.product_name}</h3><small className="muted">For {offer.request.item_name}</small></div><div><strong>{money(offer.price)} × {offer.quantity}</strong><span className="badge">{offer.status}</span></div></article>)}</div></>}
      </>}
    </section>
  </div>;
}

function OrderList({ orders, onAction }: { orders: Order[]; onAction: (order: Order, action: "ready" | "complete") => void }) {
  return <section className="vendor-panel"><div className="panel-title"><h3>Reservations and orders</h3><span>{orders.length} records</span></div>{orders.length ? orders.map(order=><article className="vendor-order" key={order.id}><div><small>#{order.id.slice(0,8).toUpperCase()}</small><strong>{order.items.map(item=>item.product_name).join(", ")}</strong><span>{money(order.total)} · {order.flash_request_id ? "Flash Request" : "Listed product"}</span></div><div><span className="badge">{order.ready_at && order.status === "reserved" ? "ready" : order.status}</span>{order.status === "reserved" && <button className="button small secondary" onClick={()=>void onAction(order, order.ready_at ? "complete" : "ready")}>{order.ready_at ? "Complete pickup" : "Mark ready"}</button>}</div></article>) : <div className="empty"><p>No orders match this view.</p></div>}</section>;
}

function DemandRadar({ requests, onOffer }: { requests: Request[]; onOffer: (event: FormEvent<HTMLFormElement>, id: string) => void }) {
  return <section className="vendor-panel radar"><div className="panel-title"><h3>Live Demand Radar</h3><span className="availability"><span className="dot" />Live</span></div>{requests.length ? requests.map(request=><article className="radar-card" key={request.id}><span className="eyebrow">{request.zone} · {request.category}</span><h3>{request.item_name}</h3><p className="muted">{request.quantity} requested · {request.max_price == null ? "No maximum price" : `Up to ${money(request.max_price)}`}</p><form className="offer-mini" onSubmit={event=>void onOffer(event,request.id)}><input className="input" name="productName" defaultValue={request.item_name} aria-label={`Offered product for ${request.item_name}`} required /><div><input className="input" name="quantity" type="number" min="1" defaultValue={request.quantity} aria-label="Quantity available" required /><input className="input" name="price" type="number" min="0" step=".01" placeholder="Unit price" aria-label="Unit price" required /></div><input className="input" name="readyMinutes" type="number" min="1" defaultValue="15" aria-label="Ready in minutes" required /><input className="input" name="note" placeholder="Optional note" aria-label="Offer note" /><button className="button small">Submit offer</button></form></article>) : <div className="empty"><p>No eligible open requests in your store’s zone and categories.</p></div>}</section>;
}
