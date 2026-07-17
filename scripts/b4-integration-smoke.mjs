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
const email = `b4-integration-${suffix}@zonemart.demo`;
const password = randomBytes(24).toString("base64url");
let customerId;
const orderIds = [];
const productIds = [];
const requestIds = [];

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "B4 Integration Customer",
      role: "customer",
      zone: "Anna Nagar",
    },
  });
  if (createError) throw createError;
  customerId = created.user.id;

  const customer = createClient(url, anon, { auth: { persistSession: false } });
  const vendor = createClient(url, anon, { auth: { persistSession: false } });
  const [customerAuth, vendorAuth] = await Promise.all([
    customer.auth.signInWithPassword({ email, password }),
    vendor.auth.signInWithPassword({
      email: "vendor.anna@zonemart.demo",
      password: required("DEMO_VENDOR_PASSWORD"),
    }),
  ]);
  if (customerAuth.error) throw customerAuth.error;
  if (vendorAuth.error) throw vendorAuth.error;

  const { data: product, error: productError } = await vendor.rpc(
    "vendor_create_product",
    {
      p_name: "B4 Integration Product",
      p_description: "Dedicated fulfilment test product",
      p_category: "Electronics",
      p_price: 400,
      p_stock: 1,
      p_image_url: "",
      p_active: true,
    },
  );
  if (productError) throw productError;
  productIds.push(product.id);

  const { data: updated, error: updateError } = await vendor.rpc(
    "vendor_update_product",
    {
      p_product_id: product.id,
      p_name: "B4 Updated Integration Product",
      p_description: "Updated safely by its vendor",
      p_category: "Electronics",
      p_price: 450,
      p_stock: 1,
      p_image_url: "",
      p_active: true,
    },
  );
  if (updateError) throw updateError;
  if (Number(updated.price) !== 450) throw new Error("Product update failed");

  const { data: reservation, error: reserveError } = await customer.rpc(
    "reserve_product",
    { p_product_id: product.id, p_quantity: 1 },
  );
  if (reserveError) throw reserveError;
  const listedOrder = reservation[0];
  orderIds.push(listedOrder.order_id);

  const { data: visibleOrder, error: visibleError } = await vendor
    .from("orders")
    .select("id")
    .eq("id", listedOrder.order_id)
    .single();
  if (visibleError || visibleOrder.id !== listedOrder.order_id) {
    throw visibleError ?? new Error("Vendor could not see its order");
  }

  const { error: readyError } = await vendor.rpc("vendor_mark_order_ready", {
    p_order_id: listedOrder.order_id,
  });
  if (readyError) throw readyError;
  const { error: wrongCode } = await vendor.rpc("vendor_complete_order", {
    p_order_id: listedOrder.order_id,
    p_pickup_code: "BAD000",
  });
  if (!wrongCode?.message.includes("INVALID_PICKUP_CODE")) {
    throw new Error("Incorrect pickup code was not rejected");
  }
  const { error: completeError } = await vendor.rpc("vendor_complete_order", {
    p_order_id: listedOrder.order_id,
    p_pickup_code: listedOrder.pickup_code,
  });
  if (completeError) throw completeError;

  await admin
    .from("orders")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", listedOrder.order_id);
  await customer.rpc("expire_reservations");
  const [{ data: completedOrder }, { data: completedProduct }] = await Promise.all([
    admin.from("orders").select("status").eq("id", listedOrder.order_id).single(),
    admin.from("products").select("stock").eq("id", product.id).single(),
  ]);
  if (completedOrder.status !== "completed" || completedProduct.stock !== 0) {
    throw new Error("Completed order incorrectly restored stock");
  }

  const { data: cancelProduct, error: cancelProductError } = await vendor.rpc(
    "vendor_create_product",
    {
      p_name: "B4 Cancellation Product",
      p_description: "Dedicated cancellation test",
      p_category: "Electronics",
      p_price: 200,
      p_stock: 1,
      p_image_url: "",
      p_active: true,
    },
  );
  if (cancelProductError) throw cancelProductError;
  productIds.push(cancelProduct.id);
  const { data: cancelReservation, error: cancelReserveError } = await customer.rpc(
    "reserve_product",
    { p_product_id: cancelProduct.id, p_quantity: 1 },
  );
  if (cancelReserveError) throw cancelReserveError;
  const cancelOrder = cancelReservation[0];
  orderIds.push(cancelOrder.order_id);
  const { error: cancelError } = await customer.rpc("customer_cancel_order", {
    p_order_id: cancelOrder.order_id,
  });
  if (cancelError) throw cancelError;
  const { error: repeatedCancel } = await customer.rpc("customer_cancel_order", {
    p_order_id: cancelOrder.order_id,
  });
  if (!repeatedCancel?.message.includes("ORDER_ALREADY_CANCELLED")) {
    throw new Error("Repeated cancellation did not return a stable error");
  }
  const { data: restored } = await admin
    .from("products")
    .select("stock")
    .eq("id", cancelProduct.id)
    .single();
  if (restored.stock !== 1) throw new Error("Listed stock was not restored once");

  const { error: deactivateError } = await vendor.rpc("vendor_update_product", {
    p_product_id: cancelProduct.id,
    p_name: cancelProduct.name,
    p_description: cancelProduct.description,
    p_category: cancelProduct.category,
    p_price: cancelProduct.price,
    p_stock: cancelProduct.stock,
    p_image_url: "",
    p_active: false,
  });
  if (deactivateError) throw deactivateError;
  const { error: inactiveReserve } = await customer.rpc("reserve_product", {
    p_product_id: cancelProduct.id,
    p_quantity: 1,
  });
  if (!inactiveReserve?.message.includes("OUT_OF_STOCK")) {
    throw new Error("Inactive product was reservable");
  }

  async function createFlashOrder(label) {
    const { data: request, error: requestError } = await customer.rpc(
      "create_flash_request",
      {
        p_item_name: label,
        p_description: "B4 dedicated Flash test",
        p_category: "Electronics",
        p_quantity: 1,
        p_max_price: 1000,
        p_urgency_minutes: 30,
      },
    );
    if (requestError) throw requestError;
    requestIds.push(request.id);
    const { data: offer, error: offerError } = await vendor.rpc(
      "upsert_flash_offer",
      {
        p_request_id: request.id,
        p_product_name: `${label} Offered`,
        p_quantity: 1,
        p_unit_price: 500,
        p_note: "Ready",
        p_ready_minutes: 5,
        p_expiration_minutes: 30,
      },
    );
    if (offerError) throw offerError;
    const { data: accepted, error: acceptError } = await customer.rpc(
      "accept_flash_offer",
      { p_request_id: request.id, p_offer_id: offer.id },
    );
    if (acceptError) throw acceptError;
    orderIds.push(accepted[0].order_id);
    return accepted[0];
  }

  const flashComplete = await createFlashOrder("B4 Flash Complete");
  await vendor.rpc("vendor_mark_order_ready", { p_order_id: flashComplete.order_id });
  const { error: flashCompleteError } = await vendor.rpc("vendor_complete_order", {
    p_order_id: flashComplete.order_id,
    p_pickup_code: flashComplete.pickup_code,
  });
  if (flashCompleteError) throw flashCompleteError;

  const baselineStock = restored.stock;
  const flashCancel = await createFlashOrder("B4 Flash Cancel");
  const { error: flashCancelError } = await customer.rpc("customer_cancel_order", {
    p_order_id: flashCancel.order_id,
  });
  if (flashCancelError) throw flashCancelError;
  const { data: afterFlashCancel } = await admin
    .from("products")
    .select("stock")
    .eq("id", cancelProduct.id)
    .single();
  if (afterFlashCancel.stock !== baselineStock) {
    throw new Error("Flash cancellation changed listed stock");
  }

  console.log("B4 integration smoke passed.");
} finally {
  if (orderIds.length) await admin.from("orders").delete().in("id", orderIds);
  if (requestIds.length) {
    await admin.from("flash_requests").delete().in("id", requestIds);
  }
  if (productIds.length) await admin.from("products").delete().in("id", productIds);
  if (customerId) await admin.auth.admin.deleteUser(customerId);
}
