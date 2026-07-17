import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const productId =
  process.env.CONCURRENCY_PRODUCT_ID ?? "20000000-0000-4000-8000-000000000008";

async function signedInClient(email, password) {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const [first, second] = await Promise.all([
  signedInClient(
    process.env.CONCURRENCY_CUSTOMER_1_EMAIL ?? "customer@zonemart.demo",
    required("DEMO_CUSTOMER_PASSWORD"),
  ),
  signedInClient(
    process.env.CONCURRENCY_CUSTOMER_2_EMAIL ?? "customer@zonemart.demo",
    process.env.CONCURRENCY_CUSTOMER_2_PASSWORD ??
      required("DEMO_CUSTOMER_PASSWORD"),
  ),
]);

const results = await Promise.all([
  first.rpc("reserve_product", { p_product_id: productId, p_quantity: 1 }),
  second.rpc("reserve_product", { p_product_id: productId, p_quantity: 1 }),
]);

const successes = results.filter((result) => !result.error);
const conflicts = results.filter((result) =>
  result.error?.message.includes("OUT_OF_STOCK"),
);
if (successes.length !== 1 || conflicts.length !== 1) {
  throw new Error(`Expected one success and one OUT_OF_STOCK: ${JSON.stringify(results)}`);
}
console.log("Concurrency verification passed: one reservation won and one sold out.");
