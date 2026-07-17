import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
const url = required("NEXT_PUBLIC_SUPABASE_URL");
const anon = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const email = `b4-concurrency-${suffix}@zonemart.demo`;
const password = randomBytes(24).toString("base64url");
let customerId;
const productIds = [];
const orderIds = [];

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "B4 Concurrency Customer",
      role: "customer",
      zone: "Anna Nagar",
    },
  });
  if (createError) throw createError;
  customerId = created.user.id;

  const customerA = createClient(url, anon, { auth: { persistSession: false } });
  const customerB = createClient(url, anon, { auth: { persistSession: false } });
  const vendor = createClient(url, anon, { auth: { persistSession: false } });
  const authResults = await Promise.all([
    customerA.auth.signInWithPassword({ email, password }),
    customerB.auth.signInWithPassword({ email, password }),
    vendor.auth.signInWithPassword({
      email: "vendor.anna@zonemart.demo",
      password: required("DEMO_VENDOR_PASSWORD"),
    }),
  ]);
  const authFailure = authResults.find((result) => result.error);
  if (authFailure?.error) throw authFailure.error;

  async function createReservedOrder(name) {
    const { data: product, error: productError } = await vendor.rpc(
      "vendor_create_product",
      {
        p_name: name,
        p_description: "Dedicated B4 race product",
        p_category: "Electronics",
        p_price: 100,
        p_stock: 1,
        p_image_url: "",
        p_active: true,
      },
    );
    if (productError) throw productError;
    productIds.push(product.id);
    const { data: reserved, error: reserveError } = await customerA.rpc(
      "reserve_product",
      { p_product_id: product.id, p_quantity: 1 },
    );
    if (reserveError) throw reserveError;
    orderIds.push(reserved[0].order_id);
    return { product, order: reserved[0] };
  }

  const completeRace = await createReservedOrder("B4 Complete Cancel Race");
  const { error: readyError } = await vendor.rpc("vendor_mark_order_ready", {
    p_order_id: completeRace.order.order_id,
  });
  if (readyError) throw readyError;
  const completeCancelResults = await Promise.all([
    vendor.rpc("vendor_complete_order", {
      p_order_id: completeRace.order.order_id,
      p_pickup_code: completeRace.order.pickup_code,
    }),
    customerA.rpc("customer_cancel_order", {
      p_order_id: completeRace.order.order_id,
    }),
  ]);
  if (completeCancelResults.filter((result) => !result.error).length !== 1) {
    throw new Error("Complete versus cancel did not produce one winner");
  }
  const [{ data: raceOrder }, { data: raceProduct }] = await Promise.all([
    admin
      .from("orders")
      .select("status")
      .eq("id", completeRace.order.order_id)
      .single(),
    admin
      .from("products")
      .select("stock")
      .eq("id", completeRace.product.id)
      .single(),
  ]);
  if (
    !(
      (raceOrder.status === "completed" && raceProduct.stock === 0) ||
      (raceOrder.status === "cancelled" && raceProduct.stock === 1)
    )
  ) {
    throw new Error("Complete/cancel race left invalid stock");
  }

  const expireRace = await createReservedOrder("B4 Cancel Expire Race");
  await admin
    .from("orders")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", expireRace.order.order_id);
  await Promise.all([
    customerA.rpc("customer_cancel_order", { p_order_id: expireRace.order.order_id }),
    customerB.rpc("expire_reservations"),
  ]);
  const [{ data: expiredOrder }, { data: expiredProduct }] = await Promise.all([
    admin
      .from("orders")
      .select("status")
      .eq("id", expireRace.order.order_id)
      .single(),
    admin
      .from("products")
      .select("stock")
      .eq("id", expireRace.product.id)
      .single(),
  ]);
  if (expiredOrder.status !== "expired" || expiredProduct.stock !== 1) {
    throw new Error("Cancel/expire race violated exactly-once restoration");
  }

  const repeated = await createReservedOrder("B4 Repeated Cancel Race");
  const first = await customerA.rpc("customer_cancel_order", {
    p_order_id: repeated.order.order_id,
  });
  const second = await customerB.rpc("customer_cancel_order", {
    p_order_id: repeated.order.order_id,
  });
  if (first.error || !second.error?.message.includes("ORDER_ALREADY_CANCELLED")) {
    throw new Error("Repeated cancellation did not return stable results");
  }
  const { data: repeatedProduct } = await admin
    .from("products")
    .select("stock")
    .eq("id", repeated.product.id)
    .single();
  if (repeatedProduct.stock !== 1) {
    throw new Error("Repeated cancellation restored stock more than once");
  }

  console.log("B4 lifecycle concurrency verification passed.");
} finally {
  if (orderIds.length) await admin.from("orders").delete().in("id", orderIds);
  if (productIds.length) await admin.from("products").delete().in("id", productIds);
  if (customerId) await admin.auth.admin.deleteUser(customerId);
}
