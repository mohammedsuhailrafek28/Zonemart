-- Phase B2: listed-product cart, checkout, direct reservation, and expiration.

create or replace function public.assert_customer()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = caller_id and role = 'customer'
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return caller_id;
end;
$$;

create or replace function public.generate_pickup_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  perform public.assert_customer();
  loop
    candidate := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.orders where pickup_code = candidate
    );
  end loop;
  return candidate;
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
  perform public.assert_customer();

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

create or replace function public.checkout_cart()
returns table (
  order_id uuid,
  total numeric,
  pickup_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  cart_count integer;
  store_count integer;
  selected_store uuid;
  computed_total numeric(12,2);
  new_order_id uuid;
  new_pickup_code text;
  new_expires_at timestamptz := now() + interval '30 minutes';
  item record;
begin
  caller_id := public.assert_customer();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );
  perform public.expire_reservations();

  select count(*), count(distinct p.store_id), min(p.store_id::text)::uuid
  into cart_count, store_count, selected_store
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = caller_id;

  if cart_count = 0 then
    raise exception using errcode = 'P0001', message = 'EMPTY_CART';
  end if;
  if store_count <> 1 then
    raise exception using errcode = 'P0001', message = 'MULTI_STORE_CART';
  end if;

  select coalesce(sum(ci.quantity * p.price), 0)
  into computed_total
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = caller_id;

  for item in
    select p.id, p.name, p.active, ci.quantity
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = caller_id
    order by p.id
  loop
    update public.products
    set stock = stock - item.quantity
    where id = item.id
      and active = true
      and stock >= item.quantity;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'OUT_OF_STOCK|' || item.name;
    end if;
  end loop;

  loop
    new_pickup_code := public.generate_pickup_code();
    begin
      insert into public.orders (
        user_id, store_id, status, total, pickup_code, expires_at
      )
      values (
        caller_id, selected_store, 'reserved', computed_total,
        new_pickup_code, new_expires_at
      )
      returning id into new_order_id;
      exit;
    exception when unique_violation then
      -- A concurrent six-character code collision retries inside this transaction.
    end;
  end loop;

  insert into public.order_items (
    order_id, product_id, product_name, quantity, unit_price
  )
  select new_order_id, p.id, p.name, ci.quantity, p.price
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = caller_id
  order by p.id;

  delete from public.cart_items where user_id = caller_id;

  return query
  select new_order_id, computed_total, new_pickup_code, new_expires_at;
end;
$$;

create or replace function public.reserve_product(
  p_product_id uuid,
  p_quantity integer
)
returns table (
  order_id uuid,
  total numeric,
  pickup_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  product_row record;
  new_order_id uuid;
  new_pickup_code text;
  new_expires_at timestamptz := now() + interval '30 minutes';
  computed_total numeric(12,2);
begin
  caller_id := public.assert_customer();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );
  perform public.expire_reservations();

  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  select id, store_id, name, price, active
  into product_row
  from public.products
  where id = p_product_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not product_row.active then
    raise exception using
      errcode = 'P0001',
      message = 'OUT_OF_STOCK|' || product_row.name;
  end if;

  update public.products
  set stock = stock - p_quantity
  where id = p_product_id
    and active = true
    and stock >= p_quantity;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'OUT_OF_STOCK|' || product_row.name;
  end if;

  computed_total := product_row.price * p_quantity;
  loop
    new_pickup_code := public.generate_pickup_code();
    begin
      insert into public.orders (
        user_id, store_id, status, total, pickup_code, expires_at
      )
      values (
        caller_id, product_row.store_id, 'reserved', computed_total,
        new_pickup_code, new_expires_at
      )
      returning id into new_order_id;
      exit;
    exception when unique_violation then
      -- A concurrent six-character code collision retries inside this transaction.
    end;
  end loop;

  insert into public.order_items (
    order_id, product_id, product_name, quantity, unit_price
  )
  values (
    new_order_id, product_row.id, product_row.name,
    p_quantity, product_row.price
  );

  return query
  select new_order_id, computed_total, new_pickup_code, new_expires_at;
end;
$$;

create or replace function public.set_cart_item(
  p_product_id uuid,
  p_quantity integer,
  p_replace_cart boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  requested_product record;
  existing_store uuid;
begin
  caller_id := public.assert_customer();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  select id, store_id, name, active, stock
  into requested_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if not requested_product.active then
    raise exception using errcode = 'P0001', message = 'INACTIVE_PRODUCT';
  end if;
  if requested_product.stock < p_quantity then
    raise exception using
      errcode = 'P0001',
      message = 'OUT_OF_STOCK|' || requested_product.name;
  end if;

  select p.store_id into existing_store
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = caller_id
  order by p.id
  limit 1
  for update of ci;

  if existing_store is not null and existing_store <> requested_product.store_id then
    if not p_replace_cart then
      raise exception using errcode = 'P0001', message = 'DIFFERENT_STORE';
    end if;
    delete from public.cart_items where user_id = caller_id;
  end if;

  insert into public.cart_items (user_id, product_id, quantity)
  values (caller_id, p_product_id, p_quantity)
  on conflict (user_id, product_id)
  do update set quantity = excluded.quantity;
end;
$$;

create or replace function public.remove_cart_item(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
begin
  caller_id := public.assert_customer();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );
  delete from public.cart_items
  where user_id = caller_id and product_id = p_product_id;
end;
$$;

create or replace function public.clear_cart()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
begin
  caller_id := public.assert_customer();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );
  delete from public.cart_items where user_id = caller_id;
end;
$$;

revoke all on function public.assert_customer() from public;
revoke all on function public.generate_pickup_code() from public;
revoke all on function public.expire_reservations() from public;
revoke all on function public.checkout_cart() from public;
revoke all on function public.reserve_product(uuid, integer) from public;
revoke all on function public.set_cart_item(uuid, integer, boolean) from public;
revoke all on function public.remove_cart_item(uuid) from public;
revoke all on function public.clear_cart() from public;

grant execute on function public.expire_reservations() to authenticated;
grant execute on function public.checkout_cart() to authenticated;
grant execute on function public.reserve_product(uuid, integer) to authenticated;
grant execute on function public.set_cart_item(uuid, integer, boolean) to authenticated;
grant execute on function public.remove_cart_item(uuid) to authenticated;
grant execute on function public.clear_cart() to authenticated;

-- Force cart mutations through the invariant-preserving RPCs.
revoke insert, update, delete on public.cart_items from authenticated;
