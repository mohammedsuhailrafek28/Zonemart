import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const productId = randomUUID();
let orderId;

async function signedInClient() {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: "customer@zonemart.demo",
    password: required("DEMO_CUSTOMER_PASSWORD"),
  });
  if (error) throw error;
  return client;
}

try {
  const { error: productError } = await admin.from("products").insert({
    id: productId,
    store_id: "10000000-0000-4000-8000-000000000001",
    name: "Listed Reservation Concurrency Product",
    description: "Dedicated disposable race record",
    category: "Electronics",
    price: 100,
    stock: 1,
    image_url: null,
    active: true,
  });
  if (productError) throw productError;

  const [first, second] = await Promise.all([signedInClient(), signedInClient()]);
  const results = await Promise.all([
    first.rpc("reserve_product", { p_product_id: productId, p_quantity: 1 }),
    second.rpc("reserve_product", { p_product_id: productId, p_quantity: 1 }),
  ]);
  const successes = results.filter((result) => !result.error);
  const conflicts = results.filter((result) =>
    result.error?.message.includes("OUT_OF_STOCK"),
  );
  if (successes.length !== 1 || conflicts.length !== 1) {
    throw new Error("Expected one success and one OUT_OF_STOCK");
  }
  orderId = successes[0].data?.[0]?.order_id;
  console.log("Listed reservation concurrency verification passed.");
} finally {
  if (orderId) await admin.from("orders").delete().eq("id", orderId);
  await admin.from("products").delete().eq("id", productId);
}
