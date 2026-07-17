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
const email = `flash-concurrency-${suffix}@zonemart.demo`;
const password = randomBytes(24).toString("base64url");
let customerId;
let requestId;
let orderId;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Flash Concurrency Customer",
      role: "customer",
      zone: "Anna Nagar",
    },
  });
  if (createError) throw createError;
  customerId = created.user.id;

  const customerA = createClient(url, anon, { auth: { persistSession: false } });
  const customerB = createClient(url, anon, { auth: { persistSession: false } });
  const vendor = createClient(url, anon, { auth: { persistSession: false } });
  const credentials = { email, password };
  const authResults = await Promise.all([
    customerA.auth.signInWithPassword(credentials),
    customerB.auth.signInWithPassword(credentials),
    vendor.auth.signInWithPassword({
      email: "vendor.anna@zonemart.demo",
      password: required("DEMO_VENDOR_PASSWORD"),
    }),
  ]);
  const authFailure = authResults.find((result) => result.error);
  if (authFailure?.error) throw authFailure.error;

  const { data: request, error: requestError } = await customerA.rpc(
    "create_flash_request",
    {
      p_item_name: "Concurrency Test Adapter",
      p_description: "Dedicated test record",
      p_category: "Electronics",
      p_quantity: 1,
      p_max_price: 2000,
      p_urgency_minutes: 30,
    },
  );
  if (requestError) throw requestError;
  requestId = request.id;

  const { data: offer, error: offerError } = await vendor.rpc("upsert_flash_offer", {
    p_request_id: requestId,
    p_product_name: "Concurrency Test Adapter",
    p_quantity: 1,
    p_unit_price: 1000,
    p_note: "Concurrency test",
    p_ready_minutes: 5,
    p_expiration_minutes: 30,
  });
  if (offerError) throw offerError;

  const results = await Promise.all([
    customerA.rpc("accept_flash_offer", {
      p_request_id: requestId,
      p_offer_id: offer.id,
    }),
    customerB.rpc("accept_flash_offer", {
      p_request_id: requestId,
      p_offer_id: offer.id,
    }),
  ]);
  const winners = results.filter((result) => !result.error);
  const losers = results.filter((result) =>
    result.error?.message.includes("OFFER_ALREADY_ACCEPTED"),
  );
  if (winners.length !== 1 || losers.length !== 1) {
    throw new Error("Expected one acceptance and one stable losing conflict");
  }
  orderId = winners[0].data?.[0]?.order_id;

  const [{ count: orderCount }, { count: acceptedCount }] = await Promise.all([
    admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("flash_request_id", requestId),
    admin
      .from("flash_offers")
      .select("*", { count: "exact", head: true })
      .eq("request_id", requestId)
      .eq("status", "accepted"),
  ]);
  if (orderCount !== 1 || acceptedCount !== 1) {
    throw new Error("Concurrency invariant failed");
  }
  console.log("Flash acceptance concurrency verification passed.");
} finally {
  if (orderId) await admin.from("orders").delete().eq("id", orderId);
  if (requestId) await admin.from("flash_requests").delete().eq("id", requestId);
  if (customerId) await admin.auth.admin.deleteUser(customerId);
}
