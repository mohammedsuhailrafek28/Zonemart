-- Phase B4: vendor catalogue, fulfilment, cancellation, and safe finalization.

alter table public.stores
  add column description text,
  add column address text,
  add column contact_display text,
  add column operating_hours text;

alter table public.products
  add column archived_at timestamptz;

alter table public.orders
  add column ready_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancelled_by text check (cancelled_by in ('customer', 'vendor'));

create index orders_vendor_status_ready_idx
  on public.orders(store_id, status, ready_at, created_at desc);
create index products_vendor_archive_idx
  on public.products(store_id, archived_at, created_at desc);

create or replace function public.assert_marketplace_actor()
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role public.user_role;
begin
  if caller_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  select role into caller_role from public.profiles where id = caller_id;
  if caller_role is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return caller_role;
end;
$$;

create or replace function public.expire_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  perform public.assert_marketplace_actor();

  with expired as materialized (
    update public.orders
    set status = 'expired'
    where status = 'reserved' and expires_at <= now()
    returning id
  ),
  quantities as materialized (
    select oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    join expired e on e.id = oi.order_id
    where oi.product_id is not null
    group by oi.product_id
  ),
  restored as (
    update public.products p
    set stock = p.stock + q.quantity
    from quantities q
    where p.id = q.product_id
    returning p.id
  )
  select count(*)::integer into expired_count from expired;

  return expired_count;
end;
$$;

create or replace function public.vendor_update_store(
  p_name text,
  p_description text,
  p_address text,
  p_contact_display text,
  p_operating_hours text
)
returns public.stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  updated_store public.stores;
begin
  caller_id := public.assert_vendor();
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120
    or (p_description is not null and char_length(p_description) > 1000)
    or (p_address is not null and char_length(p_address) > 500)
    or (p_contact_display is not null and char_length(p_contact_display) > 200)
    or (p_operating_hours is not null and char_length(p_operating_hours) > 300)
  then
    raise exception using errcode = 'P0001', message = 'INVALID_STORE';
  end if;

  update public.stores
  set name = trim(p_name),
      description = nullif(trim(p_description), ''),
      address = nullif(trim(p_address), ''),
      contact_display = nullif(trim(p_contact_display), ''),
      operating_hours = nullif(trim(p_operating_hours), '')
  where id = (
    select id
    from public.stores
    where owner_id = caller_id
    order by created_at, id
    limit 1
  )
  returning * into updated_store;

  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_NOT_FOUND';
  end if;
  return updated_store;
end;
$$;

create or replace function public.vendor_create_product(
  p_name text,
  p_description text,
  p_category text,
  p_price numeric,
  p_stock integer,
  p_image_url text,
  p_active boolean
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  vendor_store public.stores;
  created_product public.products;
begin
  caller_id := public.assert_vendor();
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 160
    or p_category not in (
      'Electronics', 'Stationery', 'Project Materials', 'Repair Essentials'
    )
    or p_price is null or p_price < 0
    or p_stock is null or p_stock < 0
    or (p_description is not null and char_length(p_description) > 2000)
    or (p_image_url is not null and char_length(p_image_url) > 2000)
  then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  select * into vendor_store
  from public.stores
  where owner_id = caller_id
  order by created_at, id
  limit 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'STORE_NOT_FOUND';
  end if;
  if p_active and (not vendor_store.active or not vendor_store.verified) then
    raise exception using errcode = 'P0001', message = 'STORE_NOT_VERIFIED';
  end if;

  insert into public.products (
    store_id, name, description, category, price, stock, image_url, active
  )
  values (
    vendor_store.id, trim(p_name), coalesce(trim(p_description), ''), p_category,
    p_price, p_stock, nullif(trim(p_image_url), ''), p_active
  )
  returning * into created_product;
  return created_product;
end;
$$;

create or replace function public.vendor_update_product(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_price numeric,
  p_stock integer,
  p_image_url text,
  p_active boolean
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  product_row public.products;
  vendor_store public.stores;
begin
  caller_id := public.assert_vendor();
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 160
    or p_category not in (
      'Electronics', 'Stationery', 'Project Materials', 'Repair Essentials'
    )
    or p_price is null or p_price < 0
    or p_stock is null or p_stock < 0
    or (p_description is not null and char_length(p_description) > 2000)
    or (p_image_url is not null and char_length(p_image_url) > 2000)
  then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  select p.* into product_row
  from public.products p
  join public.stores s on s.id = p.store_id
  where p.id = p_product_id and s.owner_id = caller_id
  for update of p;
  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;

  select * into vendor_store from public.stores where id = product_row.store_id;
  if p_active and (not vendor_store.active or not vendor_store.verified) then
    raise exception using errcode = 'P0001', message = 'STORE_NOT_VERIFIED';
  end if;

  update public.products
  set name = trim(p_name),
      description = coalesce(trim(p_description), ''),
      category = p_category,
      price = p_price,
      stock = p_stock,
      image_url = nullif(trim(p_image_url), ''),
      active = p_active,
      archived_at = case when p_active then null else archived_at end
  where id = p_product_id
  returning * into product_row;
  return product_row;
end;
$$;

create or replace function public.vendor_archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
begin
  caller_id := public.assert_vendor();
  update public.products p
  set active = false, archived_at = coalesce(archived_at, now())
  from public.stores s
  where p.id = p_product_id
    and s.id = p.store_id
    and s.owner_id = caller_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.vendor_mark_order_ready(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  order_row public.orders;
  marked_at timestamptz := now();
begin
  caller_id := public.assert_vendor();
  perform public.expire_reservations();

  select o.* into order_row
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id and s.owner_id = caller_id
  for update of o;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if order_row.status = 'expired' or order_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'ORDER_EXPIRED';
  end if;
  if order_row.status = 'completed' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_COMPLETED';
  end if;
  if order_row.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_CANCELLED';
  end if;
  if order_row.status <> 'reserved' then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_STATUS';
  end if;

  update public.orders
  set ready_at = coalesce(ready_at, marked_at)
  where id = p_order_id
  returning ready_at into marked_at;
  return marked_at;
end;
$$;

create or replace function public.vendor_complete_order(
  p_order_id uuid,
  p_pickup_code text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  order_row public.orders;
  finished_at timestamptz := now();
begin
  caller_id := public.assert_vendor();
  perform public.expire_reservations();

  select o.* into order_row
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id and s.owner_id = caller_id
  for update of o;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if order_row.status = 'expired' or order_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'ORDER_EXPIRED';
  end if;
  if order_row.status = 'completed' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_COMPLETED';
  end if;
  if order_row.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_CANCELLED';
  end if;
  if order_row.status <> 'reserved' or order_row.ready_at is null then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_STATUS';
  end if;
  if p_pickup_code is null
    or upper(trim(p_pickup_code)) <> order_row.pickup_code
  then
    raise exception using errcode = 'P0001', message = 'INVALID_PICKUP_CODE';
  end if;

  update public.orders
  set status = 'completed', completed_at = finished_at
  where id = p_order_id;
  return finished_at;
end;
$$;

create or replace function public.customer_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  order_row public.orders;
begin
  caller_id := public.assert_customer();
  perform public.expire_reservations();

  select * into order_row
  from public.orders
  where id = p_order_id and user_id = caller_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if order_row.status = 'expired' or order_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'ORDER_EXPIRED';
  end if;
  if order_row.status = 'completed' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_COMPLETED';
  end if;
  if order_row.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_CANCELLED';
  end if;
  if order_row.status <> 'reserved' then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_STATUS';
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
  where id = p_order_id;

  update public.products p
  set stock = p.stock + restored.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id and product_id is not null
    group by product_id
  ) restored
  where p.id = restored.product_id;
end;
$$;

create or replace function public.vendor_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  order_row public.orders;
begin
  caller_id := public.assert_vendor();
  perform public.expire_reservations();

  select o.* into order_row
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id and s.owner_id = caller_id
  for update of o;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if order_row.status = 'expired' or order_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'ORDER_EXPIRED';
  end if;
  if order_row.status = 'completed' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_COMPLETED';
  end if;
  if order_row.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'ORDER_ALREADY_CANCELLED';
  end if;
  if order_row.status <> 'reserved' then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_STATUS';
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = 'vendor'
  where id = p_order_id;

  update public.products p
  set stock = p.stock + restored.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id and product_id is not null
    group by product_id
  ) restored
  where p.id = restored.product_id;
end;
$$;

revoke all on function public.assert_marketplace_actor() from public, anon, authenticated;
revoke all on function public.vendor_update_store(text, text, text, text, text) from public, anon;
revoke all on function public.vendor_create_product(text, text, text, numeric, integer, text, boolean) from public, anon;
revoke all on function public.vendor_update_product(uuid, text, text, text, numeric, integer, text, boolean) from public, anon;
revoke all on function public.vendor_archive_product(uuid) from public, anon;
revoke all on function public.vendor_mark_order_ready(uuid) from public, anon;
revoke all on function public.vendor_complete_order(uuid, text) from public, anon;
revoke all on function public.customer_cancel_order(uuid) from public, anon;
revoke all on function public.vendor_cancel_order(uuid) from public, anon;
revoke all on function public.expire_reservations() from public, anon;

grant execute on function public.vendor_update_store(text, text, text, text, text) to authenticated;
grant execute on function public.vendor_create_product(text, text, text, numeric, integer, text, boolean) to authenticated;
grant execute on function public.vendor_update_product(uuid, text, text, text, numeric, integer, text, boolean) to authenticated;
grant execute on function public.vendor_archive_product(uuid) to authenticated;
grant execute on function public.vendor_mark_order_ready(uuid) to authenticated;
grant execute on function public.vendor_complete_order(uuid, text) to authenticated;
grant execute on function public.customer_cancel_order(uuid) to authenticated;
grant execute on function public.vendor_cancel_order(uuid) to authenticated;
grant execute on function public.expire_reservations() to authenticated;

-- Prevent bypassing safe-field and verification checks through direct table writes.
revoke insert, update, delete on public.stores from authenticated;
revoke insert, update, delete on public.products from authenticated;
