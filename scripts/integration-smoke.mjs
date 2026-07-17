import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const client = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
);
const chargerId = "20000000-0000-4000-8000-000000000001";

const { error: authError } = await client.auth.signInWithPassword({
  email: "customer@zonemart.demo",
  password: required("DEMO_CUSTOMER_PASSWORD"),
});
if (authError) throw authError;

const { data: before, error: beforeError } = await client
  .from("products")
  .select("stock")
  .eq("id", chargerId)
  .single();
if (beforeError) throw beforeError;

const { error: cartError } = await client.rpc("set_cart_item", {
  p_product_id: chargerId,
  p_quantity: 1,
  p_replace_cart: true,
});
if (cartError) throw cartError;

const { data: checkout, error: checkoutError } = await client.rpc("checkout_cart");
if (checkoutError) throw checkoutError;
const order = checkout?.[0];
if (!order?.pickup_code || !order?.expires_at) throw new Error("Missing hold details");

const [{ data: after }, { data: items }, { data: cart }] = await Promise.all([
  client.from("products").select("stock").eq("id", chargerId).single(),
  client.from("order_items").select("*").eq("order_id", order.order_id),
  client.from("cart_items").select("*"),
]);
if (after.stock !== before.stock - 1) throw new Error("Stock did not decrease");
if (!items?.length) throw new Error("Order items were not created");
if (cart?.length) throw new Error("Cart was not cleared");

console.log(`Integration smoke passed for order ${order.order_id}.`);
