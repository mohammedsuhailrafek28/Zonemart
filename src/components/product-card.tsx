"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, displayError, money } from "@/lib/client-api";
import { productImage } from "@/lib/product-image";
import type { Product, Reservation } from "@/lib/ui-models";
import { useApp } from "./app-provider";

export function ProductCard({ product, onReserved }: { product: Product; onReserved: (value: Reservation & { product: Product }) => void }) {
  const { refreshCart } = useApp();
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState("");
  async function add() {
    setBusy("cart"); setMessage("");
    try {
      await api("/api/cart", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }) });
      await refreshCart(); setMessage("Added to cart.");
    } catch (error) {
      const text = displayError(error);
      if (text.toLowerCase().includes("different store") && window.confirm("Your cart contains another store. Replace it with this item?")) {
        await api("/api/cart", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1, replaceCart: true }) });
        await refreshCart(); setMessage("Cart replaced.");
      } else setMessage(text);
    } finally { setBusy(""); }
  }
  async function reserve() {
    setBusy("reserve"); setMessage("");
    try {
      const result = await api<Reservation>(`/api/products/${product.id}/reserve`, { method: "POST", body: JSON.stringify({ quantity: 1 }) });
      onReserved({ ...result, product });
    } catch (error) { setMessage(displayError(error)); } finally { setBusy(""); }
  }
  return <article className="card product-card">
    <div className="product-art">
      <Image src={productImage(product)} alt={product.name} width={500} height={500} />
    </div>
    <div className="product-body">
      <div className="store"><span className="store-icon">{product.store.name.slice(0, 1)}</span><span>{product.store.name} · {product.store.zone}</span></div>
      <span className="badge">{product.category}</span><h3 style={{ marginTop: 12 }}><Link href={`/products/${product.id}`}>{product.name}</Link></h3>
      {product.description && <p className="muted" style={{ fontSize: ".85rem" }}>{product.description}</p>}
      <div className="product-meta"><span className="price">{money(product.price)}</span><span className={product.stock > 0 ? "availability" : "badge danger"}>{product.stock > 0 ? <><span className="dot" />{product.stock} available</> : "Out of stock"}</span></div>
      <div className="product-actions"><button className="button secondary small" disabled={!product.stock || !!busy} onClick={() => void add()}>{busy === "cart" ? "Adding…" : "Add to cart"}</button><button className="button small" disabled={!product.stock || !!busy} onClick={() => void reserve()}>{busy === "reserve" ? "Reserving…" : "Reserve now"}</button></div>
      {message && <small role="status" className={message.includes("Added") || message.includes("replaced") ? "success" : "error"} style={{ marginTop: 10 }}>{message}</small>}
    </div>
  </article>;
}
