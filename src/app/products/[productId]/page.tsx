"use client";
import Image from "next/image";
import { productImage } from "@/lib/product-image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerGuard } from "@/components/customer-guard";
import { ReservationConfirmation } from "@/components/reservation-confirmation";
import { useApp } from "@/components/app-provider";
import { api, displayError, money } from "@/lib/client-api";
import type { Product, Reservation } from "@/lib/ui-models";

export default function ProductDetailsPage() {
  const { productId } = useParams<{ productId: string }>();
  const { profile, refreshCart } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(""); const [reservation, setReservation] = useState<Reservation | null>(null);
  useEffect(() => { if (profile?.role === "customer") api<Product>(`/api/products/${productId}`).then(setProduct).catch(e => setError(displayError(e))); }, [productId, profile?.role]);
  async function add() { if (!product) return; setBusy("cart"); try { await api("/api/cart",{method:"POST",body:JSON.stringify({productId,quantity:1})}); await refreshCart(); } catch(e){setError(displayError(e));} finally{setBusy("");} }
  async function reserve() { setBusy("reserve"); try { setReservation(await api<Reservation>(`/api/products/${productId}/reserve`,{method:"POST",body:JSON.stringify({quantity:1})})); } catch(e){const message=displayError(e);setError(message.toLowerCase().includes("stock") ? "Just sold out." : message);} finally{setBusy("");} }
  return <CustomerGuard><div className="container page">{reservation ? <ReservationConfirmation reservation={reservation} /> : error && !product ? <div className="error">{error}</div> : !product ? <div className="skeleton" /> :
    <div className="stitch-product-detail"><div className="stitch-detail-image"><Image src={productImage(product)} alt={product.name} width={800} height={800} priority /></div><section><Link href="/shop" className="muted">← Back to marketplace</Link><span className="badge" style={{marginTop:24}}>{product.category}</span><h1>{product.name}</h1><p className="lead">{product.description}</p><div className="store"><span className="store-icon">{product.store.name[0]}</span>{product.store.name} · {product.store.zone}</div><div className="summary-line total"><span className="price">{money(product.price)}</span><span className={product.stock ? "availability" : "badge danger"}>{product.stock ? `${product.stock} available` : "Out of stock"}</span></div>{error && <div className="error">{error}</div>}<div className="actions"><button className="button secondary" disabled={!product.stock||!!busy} onClick={()=>void add()}>{busy==="cart"?"Adding…":"Add to cart"}</button><button className="button" disabled={!product.stock||!!busy} onClick={()=>void reserve()}>{busy==="reserve"?"Reserving…":"Reserve now"}</button></div><p className="notice">Pickup readiness is confirmed by the merchant after reservation. The hold lasts 30 minutes.</p></section></div>}
  </div></CustomerGuard>;
}
