export type Role = "customer" | "vendor";
export interface Profile { id: string; full_name: string; role: Role; zone: string }
export interface Product {
  id: string; name: string; description: string | null; category: string;
  price: number | string; stock: number; image_url: string | null;
  store: { id: string; name: string; zone: string };
}
export interface CartItem {
  productId: string; name: string; imageUrl: string | null; price: number;
  quantity: number; stock: number; active: boolean; lineTotal: number;
  store: { id: string; name: string };
}
export interface Reservation {
  orderId: string; status: string; total: number; pickupCode: string; expiresAt: string;
}
export interface FlashOffer {
  id: string; product_name: string; price: number | string; quantity: number; note: string | null;
  ready_minutes: number; status: string; expires_at: string; store: { id: string; name: string; zone: string };
}
export interface FlashRequest {
  id: string; item_name: string; description: string | null; category: string; quantity: number;
  zone: string; max_price: number | string | null; urgency_minutes: number; status: string;
  expires_at: string; created_at: string; offers?: FlashOffer[];
}
