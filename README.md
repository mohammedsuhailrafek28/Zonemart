# ZoneMart backend foundation

Phases B1–B4 provide the Next.js route-handler foundation, Supabase schema,
authentication helpers, row-level security, repeatable demo data, and the atomic
listed-product and Flash Request commerce paths. The project intentionally contains
no UI.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and populate the variables listed below.

3. Install the Supabase CLI (or run it through `npx`), start local Supabase, and reset
   the database:

   ```bash
   npx supabase start
   npx supabase db reset
   ```

   For a hosted project, link it and push the migration:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. Create the genuine demo auth accounts and seed the catalogue:

   ```bash
   npm run seed
   ```

   The script is idempotent: it looks up users by email and upserts deterministic
   store and product IDs. It creates:

   - `vendor.anna@zonemart.demo`
   - `vendor.tnagar@zonemart.demo`
   - `customer@zonemart.demo`

   Passwords come from environment variables and are never committed. Do not insert
   rows directly into `auth.users`; the Admin API safely creates the accounts.

5. Run the backend:

   ```bash
   npm run dev
   ```

   Verify it at `GET http://localhost:3000/api/health`.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` — project API URL; browser-safe.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anonymous/publishable API key; browser-safe and
  constrained by RLS.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key used by the demo seed and any future
  trusted server job. Never expose it in client code or with a `NEXT_PUBLIC_` prefix.
- `DEMO_VENDOR_PASSWORD` — seed-only password for both demo vendor accounts.
- `DEMO_CUSTOMER_PASSWORD` — seed-only password for the demo customer account.

The running health endpoint needs no Supabase connection. Authenticated handlers need
the two public variables. `SUPABASE_SERVICE_ROLE_KEY` is optional at runtime and
required only for `npm run seed` or a future route that deliberately uses the admin
client. Every such route must first authenticate the caller and verify target-row
ownership; `src/lib/supabase/admin.ts` is server-only.

## Auth and profile initialization

Supabase Auth metadata can include `full_name`, `role`, and `zone`. A database trigger
creates the profile on signup and allowlists roles to `customer` or `vendor`; invalid
values fall back to `customer`. Zones are also allowlisted. Authenticated users can
finish onboarding through `POST /api/profile` with:

```json
{
  "fullName": "Demo User",
  "role": "customer",
  "zone": "Velachery"
}
```

The route validates input with Zod and writes through the caller's RLS-bound Supabase
client. Shared guards expose `requireUser`, `requireCustomer`, and `requireVendor`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx supabase db reset
npm run seed
curl http://localhost:3000/api/health
git diff --check
```

The Supabase reset and seed require Docker/local Supabase or configured hosted-project
credentials respectively.

## Listed-product commerce

Authenticated customers can use:

- `GET`, `POST`, and `DELETE /api/cart`
- `PATCH` and `DELETE /api/cart/:productId`
- `POST /api/checkout`
- `POST /api/products/:productId/reserve`
- `GET /api/orders`
- `GET /api/products`

Cart writes use database RPCs, and direct authenticated insert/update/delete grants on
`cart_items` are revoked. Checkout and Reserve Now derive the caller from `auth.uid()`,
calculate prices in PostgreSQL, guard stock updates, create a 30-minute hold, snapshot
order items, and return only generated order details. Expiry changes each eligible
order once and restores grouped listed-product quantities atomically.

After applying the B2 migration and seeding a live project, run:

```bash
npm run test:integration
```

The concurrency verifier expects the seeded stock-1 soldering iron by default. It
opens two independent authenticated sessions using the demo customer; optional second
customer credentials can be supplied:

```bash
CONCURRENCY_CUSTOMER_2_EMAIL=customer2@example.com
CONCURRENCY_CUSTOMER_2_PASSWORD=replace-me
npm run test:concurrency
```

Run it against a freshly seeded/reset product. Exactly one reservation must succeed;
the other must return `OUT_OF_STOCK`.

## Phase B5 boundary

Flash Request/offer APIs, vendor CRUD and order-management endpoints, polling
workflows, reservation completion/cancellation, payments, analytics, maps, delivery,
AI, and frontend pages remain out of scope.

## Flash Request marketplace

Customers can create, list, inspect, cancel, and atomically accept merchant offers:

- `POST` and `GET /api/flash-requests`
- `GET` and `DELETE /api/flash-requests/:requestId`
- `POST /api/flash-requests/:requestId/offers/:offerId/accept`

Eligible verified vendors can discover zone/category-matched requests and manage
their own offers:

- `GET /api/vendor/flash-requests`
- `POST /api/vendor/flash-requests/:requestId/offers`
- `GET /api/vendor/offers`
- `PATCH` and `DELETE /api/vendor/offers/:offerId`

Flash writes are RPC-only. PostgreSQL derives customer/vendor identity, store,
request zone, totals, pickup code, and lifecycle state. Acceptance locks the request
and offers, creates one linked 30-minute reserved order with a null listed-product
reference, accepts one offer, rejects competitors, and fulfills the request in one
transaction.

Hosted verification commands:

```bash
npm run test:flash-integration
npm run test:flash-concurrency
```

Both scripts create dedicated temporary records and clean them without resetting or
reseeding the hosted project.

## Vendor catalogue and fulfilment

Verified vendors can safely manage storefront display fields and their own catalogue:

- `GET` and `PATCH /api/vendor/store`
- `GET` and `POST /api/vendor/products`
- `GET`, `PATCH`, and `DELETE /api/vendor/products/:productId`

Product deletion archives and deactivates the row so order-item history remains
intact. Direct authenticated writes to stores and products are revoked; RPCs derive
the owned store and prevent vendors from changing verification or ownership.

Vendors can retrieve and fulfil only their store's orders:

- `GET /api/vendor/orders`
- `GET /api/vendor/orders/:orderId`
- `POST /api/vendor/orders/:orderId/ready`
- `POST /api/vendor/orders/:orderId/complete`
- `POST /api/vendor/orders/:orderId/cancel`
- `POST /api/orders/:orderId/cancel` for the owning customer

Ready-for-pickup is represented by `status = reserved` plus `ready_at`, preserving the
existing order enum and expiration behavior. Pickup codes are excluded from vendor
order reads and compared only inside PostgreSQL during completion. Cancellation and
expiration lock/guard active orders and restore grouped listed quantities once; null
Flash product references never change listed inventory.

Hosted B4 verification:

```bash
npm run test:b4-integration
npm run test:b4-concurrency
```
