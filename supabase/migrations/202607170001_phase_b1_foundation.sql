create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.user_role as enum ('customer', 'vendor');
create type public.order_status as enum ('reserved', 'completed', 'expired', 'cancelled');
create type public.flash_request_status as enum ('open', 'fulfilled', 'expired', 'cancelled');
create type public.flash_offer_status as enum ('open', 'accepted', 'rejected', 'expired');

create table public.zones (
  name text primary key,
  created_at timestamptz not null default now()
);

insert into public.zones (name)
values ('Anna Nagar'), ('T Nagar'), ('Velachery')
on conflict (name) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  role public.user_role not null,
  zone text not null references public.zones(name),
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  zone text not null references public.zones(name),
  category_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text not null default '',
  category text not null check (category in (
    'Electronics', 'Stationery', 'Project Materials', 'Repair Essentials'
  )),
  price numeric(12,2) not null check (price >= 0),
  stock integer not null check (stock >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  store_id uuid not null references public.stores(id),
  status public.order_status not null default 'reserved',
  total numeric(12,2) not null check (total >= 0),
  pickup_code text not null unique check (pickup_code ~ '^[A-Z0-9]{4,12}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint completed_state_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (char_length(trim(product_name)) > 0),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

create table public.flash_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null check (char_length(trim(item_name)) between 2 and 160),
  category text not null check (category in (
    'Electronics', 'Stationery', 'Project Materials', 'Repair Essentials'
  )),
  zone text not null references public.zones(name),
  max_price numeric(12,2) check (max_price is null or max_price >= 0),
  urgency_minutes integer not null check (urgency_minutes in (30, 60, 120)),
  status public.flash_request_status not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.flash_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.flash_requests(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  quantity integer not null check (quantity > 0),
  ready_minutes integer not null check (ready_minutes > 0),
  status public.flash_offer_status not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (request_id, store_id)
);

create index stores_owner_idx on public.stores(owner_id);
create index stores_zone_idx on public.stores(zone);
create index products_store_idx on public.products(store_id);
create index products_category_active_idx on public.products(category, active) where active;
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index cart_items_product_idx on public.cart_items(product_id);
create index orders_customer_created_idx on public.orders(user_id, created_at desc);
create index orders_vendor_created_idx on public.orders(store_id, created_at desc);
create index orders_reservation_expiry_idx on public.orders(expires_at)
  where status = 'reserved';
create index order_items_order_idx on public.order_items(order_id);
create index flash_requests_open_zone_category_idx
  on public.flash_requests(zone, category, created_at desc)
  where status = 'open';
create index flash_requests_customer_idx on public.flash_requests(user_id, created_at desc);
create index flash_requests_expiry_idx on public.flash_requests(expires_at)
  where status = 'open';
create index flash_offers_request_idx on public.flash_offers(request_id);
create index flash_offers_store_idx on public.flash_offers(store_id, created_at desc);
create index flash_offers_expiry_idx on public.flash_offers(expires_at)
  where status = 'open';
create unique index one_accepted_offer_per_request_idx
  on public.flash_offers(request_id) where status = 'accepted';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create or replace function public.initialize_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
  requested_zone text;
  requested_name text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' in ('customer', 'vendor')
      then (new.raw_user_meta_data ->> 'role')::public.user_role
    else 'customer'::public.user_role
  end;
  requested_zone := case
    when new.raw_user_meta_data ->> 'zone' in ('Anna Nagar', 'T Nagar', 'Velachery')
      then new.raw_user_meta_data ->> 'zone'
    else 'Anna Nagar'
  end;
  requested_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'ZoneMart User'), '@', 1)
  );

  insert into public.profiles (id, full_name, role, zone)
  values (new.id, left(requested_name, 100), requested_role, requested_zone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users
for each row execute function public.initialize_profile();

alter table public.zones enable row level security;
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.flash_requests enable row level security;
alter table public.flash_offers enable row level security;

create policy "zones are publicly readable"
on public.zones for select to anon, authenticated using (true);

create policy "users read own profile"
on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "users create own profile"
on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "users update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "stores are publicly readable"
on public.stores for select to anon, authenticated using (true);
create policy "vendors create own stores"
on public.stores for insert to authenticated with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'vendor'
  )
);
create policy "vendors update own stores"
on public.stores for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy "vendors delete own stores"
on public.stores for delete to authenticated using (owner_id = (select auth.uid()));

create policy "active products are publicly readable"
on public.products for select to anon, authenticated using (
  active or exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);
create policy "vendors create products for own stores"
on public.products for insert to authenticated with check (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);
create policy "vendors update products for own stores"
on public.products for update to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);
create policy "vendors delete products for own stores"
on public.products for delete to authenticated using (
  exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "users read own cart"
on public.cart_items for select to authenticated using (user_id = (select auth.uid()));
create policy "users add own cart items"
on public.cart_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users update own cart"
on public.cart_items for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete own cart"
on public.cart_items for delete to authenticated using (user_id = (select auth.uid()));

create policy "customers read own orders"
on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy "vendors read store orders"
on public.orders for select to authenticated using (
  exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = (select auth.uid())
  )
);

create policy "customers read own order items"
on public.order_items for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid())
  )
);
create policy "vendors read store order items"
on public.order_items for select to authenticated using (
  exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_items.order_id and s.owner_id = (select auth.uid())
  )
);

create policy "customers read own flash requests"
on public.flash_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "vendors read open local flash requests"
on public.flash_requests for select to authenticated using (
  status = 'open'
  and exists (
    select 1 from public.stores s
    where s.owner_id = (select auth.uid()) and s.zone = flash_requests.zone
  )
);
create policy "customers create own flash requests"
on public.flash_requests for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'customer'
  )
);
create policy "customers update own flash requests"
on public.flash_requests for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "customers read offers on own requests"
on public.flash_offers for select to authenticated using (
  exists (
    select 1 from public.flash_requests r
    where r.id = flash_offers.request_id and r.user_id = (select auth.uid())
  )
);
create policy "vendors read own store offers"
on public.flash_offers for select to authenticated using (
  exists (
    select 1 from public.stores s
    where s.id = flash_offers.store_id and s.owner_id = (select auth.uid())
  )
);
create policy "vendors create own store offers"
on public.flash_offers for insert to authenticated with check (
  exists (
    select 1 from public.stores s
    join public.flash_requests r on r.id = flash_offers.request_id
    where s.id = flash_offers.store_id
      and s.owner_id = (select auth.uid())
      and s.zone = r.zone
      and r.status = 'open'
  )
);
create policy "vendors update own store offers"
on public.flash_offers for update to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id = flash_offers.store_id and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = flash_offers.store_id and s.owner_id = (select auth.uid())
  )
);

revoke all on function public.initialize_profile() from public;
revoke all on function public.set_updated_at() from public;
