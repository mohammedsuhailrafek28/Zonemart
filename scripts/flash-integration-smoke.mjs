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
const email = `flash-integration-${suffix}@zonemart.demo`;
const password = randomBytes(24).toString("base64url");
let customerId;
let requestId;
let orderId;
let expiredRequestId;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Flash Integration Customer",
      role: "customer",
      zone: "Anna Nagar",
    },
  });
  if (createError) throw createError;
  customerId = created.user.id;

  const customer = createClient(url, anon, { auth: { persistSession: false } });
  const vendor = createClient(url, anon, { auth: { persistSession: false } });
  const { error: customerAuthError } = await customer.auth.signInWithPassword({
    email,
    password,
  });
  if (customerAuthError) throw customerAuthError;
  const { error: vendorAuthError } = await vendor.auth.signInWithPassword({
    email: "vendor.anna@zonemart.demo",
    password: required("DEMO_VENDOR_PASSWORD"),
  });
  if (vendorAuthError) throw vendorAuthError;

  const { data: request, error: requestError } = await customer.rpc(
    "create_flash_request",
    {
      p_item_name: "HDMI to VGA Adapter",
      p_description: "Needed for a projector demo",
      p_category: "Electronics",
      p_quantity: 2,
      p_max_price: 1500,
      p_urgency_minutes: 30,
    },
  );
  if (requestError) throw requestError;
  requestId = request.id;

  const { data: offer, error: offerError } = await vendor.rpc("upsert_flash_offer", {
    p_request_id: requestId,
    p_product_name: "HDMI to VGA Active Adapter",
    p_quantity: 2,
    p_unit_price: 1200,
    p_note: "Tested and ready for pickup",
    p_ready_minutes: 10,
    p_expiration_minutes: 30,
  });
  if (offerError) throw offerError;

  const { data: accepted, error: acceptError } = await customer.rpc(
    "accept_flash_offer",
    { p_request_id: requestId, p_offer_id: offer.id },
  );
  if (acceptError) throw acceptError;
  const order = accepted?.[0];
  orderId = order?.order_id;
  if (!orderId || !order.pickup_code || !order.expires_at) {
    throw new Error("Acceptance did not return a complete reservation");
  }

  const [{ data: finalRequest }, { data: finalOffer }, { data: orderItem }] =
    await Promise.all([
      admin.from("flash_requests").select("status").eq("id", requestId).single(),
      admin.from("flash_offers").select("status").eq("id", offer.id).single(),
      admin
        .from("order_items")
        .select("product_id, product_name, quantity, unit_price")
        .eq("order_id", orderId)
        .single(),
    ]);
  if (finalRequest.status !== "fulfilled") throw new Error("Request not fulfilled");
  if (finalOffer.status !== "accepted") throw new Error("Offer not accepted");
  if (
    orderItem.product_id !== null ||
    orderItem.quantity !== 2 ||
    Number(orderItem.unit_price) !== 1200
  ) {
    throw new Error("Flash order snapshot is incorrect");
  }

  const { data: expiring, error: expiringError } = await customer.rpc(
    "create_flash_request",
    {
      p_item_name: "Expired Integration Request",
      p_description: "Dedicated expiration check",
      p_category: "Electronics",
      p_quantity: 1,
      p_max_price: 1000,
      p_urgency_minutes: 30,
    },
  );
  if (expiringError) throw expiringError;
  expiredRequestId = expiring.id;
  const { error: ageError } = await admin
    .from("flash_requests")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", expiredRequestId);
  if (ageError) throw ageError;
  const { error: expiryError } = await customer.rpc("expire_flash_marketplace");
  if (expiryError) throw expiryError;
  const { data: expired } = await admin
    .from("flash_requests")
    .select("status")
    .eq("id", expiredRequestId)
    .single();
  if (expired.status !== "expired") throw new Error("Elapsed request did not expire");

  console.log("Flash integration smoke passed.");
} finally {
  if (orderId) await admin.from("orders").delete().eq("id", orderId);
  if (requestId) await admin.from("flash_requests").delete().eq("id", requestId);
  if (expiredRequestId) {
    await admin.from("flash_requests").delete().eq("id", expiredRequestId);
  }
  if (customerId) await admin.auth.admin.deleteUser(customerId);
}
