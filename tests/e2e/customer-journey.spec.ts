import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const anon = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const artifactDir = ".playwright-artifacts";
let admin: SupabaseClient;
let customerId = "";
let customerEmail = "";
let customerPassword = "";
let productId = "";
let requestId = "";

async function shot(page: Page, project: string, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.screenshot({ path: `${artifactDir}/${project}-${name}.png`, fullPage: true });
}

async function assertRuntime(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource: the server responded with a status of 401")) {
      consoleErrors.push(message.text());
    }
  });
  return () => {
    expect(pageErrors, "uncaught page errors").toEqual([]);
    expect(consoleErrors, "browser console errors").toEqual([]);
  };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  customerEmail = `b5a-browser-${suffix}@zonemart.demo`;
  customerPassword = randomBytes(24).toString("base64url");
  const { data: store, error: storeError } = await admin
    .from("stores").select("id").eq("zone", "Anna Nagar").eq("active", true).eq("verified", true).limit(1).single();
  if (storeError) throw storeError;
  const { data: product, error: productError } = await admin.from("products").insert({
    store_id: store.id,
    name: `B5A Long-name 65W USB-C Lab Charger ${suffix}`,
    description: "Disposable browser verification product with a deliberately long title.",
    category: "Electronics",
    price: 777,
    stock: 6,
    image_url: null,
    active: true,
  }).select("id").single();
  if (productError) throw productError;
  productId = product.id;
});

test.afterAll(async () => {
  if (!admin) return;
  if (customerId) {
    const { data: orders } = await admin.from("orders").select("id").eq("user_id", customerId);
    for (const order of orders ?? []) await admin.from("orders").delete().eq("id", order.id);
    await admin.from("flash_requests").delete().eq("user_id", customerId);
  }
  if (productId) await admin.from("products").delete().eq("id", productId);
  if (customerId) await admin.auth.admin.deleteUser(customerId);
});

test("public, authentication and complete customer commerce journey", async ({ page }, testInfo) => {
  const finishRuntimeCheck = await assertRuntime(page);
  const viewport = testInfo.project.name;
  await page.emulateMedia({ reducedMotion: "reduce" });

  const landingResponse = await page.goto("/");
  expect(landingResponse?.status(), `landing navigation failed at ${page.url()}`).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /Find it nearby/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search nearby" }).first()).toHaveAttribute("href", "/shop");
  await expect(page.getByRole("link", { name: "List your store" })).toHaveAttribute("href", "/auth/sign-up?intent=vendor");
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await shot(page, viewport, "landing");

  await page.goto("/auth/sign-up");
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Your zone")).toBeVisible();
  await shot(page, viewport, "registration");
  await page.getByLabel("Full name").fill("B5A Browser Customer");
  await page.getByLabel("Your zone").selectOption("Anna Nagar");
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Password").fill(customerPassword);
  await page.getByRole("button", { name: "Create customer account" }).click();
  await Promise.race([
    page.waitForURL(/\/shop$/, { timeout: 15_000 }),
    page.getByText("Check your email to confirm your account, then sign in.").waitFor({ timeout: 15_000 }),
  ]);
  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;
  const registered = usersPage.users.find(user => user.email === customerEmail);
  if (!registered) throw new Error("Browser registration did not create the disposable user.");
  customerId = registered.id;
  if (!registered.email_confirmed_at) {
    const { error: confirmationError } = await admin.auth.admin.updateUserById(customerId, { email_confirm: true });
    if (confirmationError) throw confirmationError;
  }
  if (page.url().endsWith("/shop")) {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
  }

  await page.goto("/auth/sign-in");
  await shot(page, viewport, "sign-in");
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Password").fill(customerPassword);
  await page.getByRole("button", { name: "Sign in" }).press("Enter");
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole("heading", { name: "What do you need nearby?" })).toBeVisible();

  const uniqueSearch = "B5A Long-name";
  await page.getByLabel("Search products").fill(uniqueSearch);
  await page.getByLabel("Category").selectOption("Electronics");
  await page.getByLabel("Zone").selectOption("Anna Nagar");
  await page.getByLabel("Search products").press("Enter");
  await expect(page.getByText(/B5A Long-name 65W USB-C Lab Charger/)).toBeVisible();
  await shot(page, viewport, "marketplace");

  await page.locator("article").filter({ hasText: /B5A Long-name 65W USB-C Lab Charger/ }).getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to cart.")).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByLabel(/Quantity for/)).toContainText("2");
  await shot(page, viewport, "cart");
  await page.getByRole("button", { name: "Checkout and reserve" }).click();
  await expect(page.getByRole("heading", { name: "Your pickup hold is confirmed" })).toBeVisible();
  await expect(page.locator(".pickup-code")).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(page.getByText(/remaining$/)).toBeVisible();

  await page.getByRole("link", { name: "View my orders" }).click();
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
  await expect(page.getByText(/B5A Long-name 65W USB-C Lab Charger/)).toBeVisible();
  await shot(page, viewport, "orders");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await expect(page.getByText("Cancelled").first()).toBeVisible();

  await page.goto("/flash-requests/new");
  await expect(page.getByRole("heading", { name: "Create a Flash Request" })).toBeVisible();
  await shot(page, viewport, "flash-form");
  await page.getByLabel("Product name").fill(`B5A HDMI VGA Adapter ${Date.now()}`);
  await page.getByLabel("Description (optional)").fill("Disposable browser-created request");
  await page.getByLabel("Category").selectOption("Electronics");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Maximum total price (optional)").fill("1500");
  await page.getByRole("button", { name: "Send to nearby merchants" }).click();
  await expect(page).toHaveURL(/\/flash-requests\/[0-9a-f-]+$/);
  requestId = page.url().split("/").pop() ?? "";

  const vendor = createClient(url, anon, { auth: { persistSession: false } });
  const { error: vendorAuthError } = await vendor.auth.signInWithPassword({
    email: "vendor.anna@zonemart.demo",
    password: required("DEMO_VENDOR_PASSWORD"),
  });
  if (vendorAuthError) throw vendorAuthError;
  const { error: offerError } = await vendor.rpc("upsert_flash_offer", {
    p_request_id: requestId,
    p_product_name: "HDMI to VGA Active Adapter — Tested",
    p_quantity: 1,
    p_unit_price: 1200,
    p_note: "Ready at the counter",
    p_ready_minutes: 10,
    p_expiration_minutes: 30,
  });
  if (offerError) throw offerError;
  await page.reload();
  await expect(page.getByText("HDMI to VGA Active Adapter — Tested")).toBeVisible();
  await shot(page, viewport, "flash-offer");
  await page.getByRole("button", { name: "Accept offer" }).click();
  await expect(page.getByRole("heading", { name: "Offer accepted and reserved" })).toBeVisible();
  await expect(page.locator(".pickup-code")).toHaveText(/^[A-Z0-9]{6}$/);
  await page.getByRole("link", { name: "View my orders" }).click();
  await expect(page.getByText("Flash Request order").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email address").fill("vendor.anna@zonemart.demo");
  await page.getByLabel("Password").fill(required("DEMO_VENDOR_PASSWORD"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/vendor-coming-soon$/);
  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: "Vendor workspace coming in B5B" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  finishRuntimeCheck();
});
