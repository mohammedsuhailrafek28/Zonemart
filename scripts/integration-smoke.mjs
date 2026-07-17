import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const customer = createClient(url, required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
});
const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const productId = randomUUID();
const storeId = "10000000-0000-4000-8000-000000000001";
let customerId;
let orderId;

try {
  const { data: auth, error: authError } = await customer.auth.signInWithPassword({
    email: "customer@zonemart.demo",
    password: required("DEMO_CUSTOMER_PASSWORD"),
  });
  if (authError) throw authError;
  customerId = auth.user.id;

  const { error: productError } = await admin.from("products").insert({
    id: productId,
    store_id: storeId,
    name: "Listed Commerce Integration Product",
    description: "Dedicated disposable integration record",
    category: "Electronics",
    price: 321,
    stock: 1,
    image_url: null,
    active: true,
  });
  if (productError) throw productError;

  const { error: cartError } = await customer.rpc("set_cart_item", {
    p_product_id: productId,
    p_quantity: 1,
    p_replace_cart: true,
  });
  if (cartError) throw cartError;

  const { data: checkout, error: checkoutError } = await customer.rpc("checkout_cart");
  if (checkoutError) throw checkoutError;
  const order = checkout?.[0];
  orderId = order?.order_id;
  if (!orderId || !order.pickup_code || !order.expires_at) {
    throw new Error("Missing hold details");
  }

  const [{ data: product }, { data: items }, { data: cart }] = await Promise.all([
    admin.from("products").select("stock").eq("id", productId).single(),
    customer.from("order_items").select("*").eq("order_id", orderId),
    customer.from("cart_items").select("*"),
  ]);
  if (product.stock !== 0) throw new Error("Stock did not decrease");
  if (!items?.length) throw new Error("Order items were not created");
  if (cart?.length) throw new Error("Cart was not cleared");

  console.log("Listed-commerce integration smoke passed.");
} finally {
  if (orderId) await admin.from("orders").delete().eq("id", orderId);
  if (customerId) await admin.from("cart_items").delete().eq("user_id", customerId);
  await admin.from("products").delete().eq("id", productId);
}
