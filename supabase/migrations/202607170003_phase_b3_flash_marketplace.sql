-- Phase B3: Flash Request and merchant offer engine.

alter table public.stores
  add column active boolean not null default true,
  add column verified boolean not null default false;

-- Stores that existed before the verification flag are trusted migration inputs.
update public.stores set verified = true;

alter table public.flash_requests
  add column description text,
  add column quantity integer not null default 1 check (quantity > 0);

alter table public.flash_offers
  add column product_name text,
  add column note text;

update public.flash_offers fo
set product_name = fr.item_name
from public.flash_requests fr
where fr.id = fo.request_id and fo.product_name is null;

alter table public.flash_offers
  alter column product_name set not null,
  add constraint flash_offer_product_name_length
    check (char_length(trim(product_name)) between 2 and 160);

alter table public.orders
  add column flash_request_id uuid references public.flash_requests(id),
  add column flash_offer_id uuid references public.flash_offers(id);

create unique index orders_flash_request_unique_idx
  on public.orders(flash_request_id) where flash_request_id is not null;
create unique index orders_flash_offer_unique_idx
  on public.orders(flash_offer_id) where flash_offer_id is not null;
create index stores_flash_eligibility_idx
  on public.stores(owner_id, zone) where active and verified;

drop policy if exists "vendors read open local flash requests" on public.flash_requests;
drop policy if exists "vendors create own store offers" on public.flash_offers;
drop policy if exists "vendors update own store offers" on public.flash_offers;

create policy "eligible vendors read open local flash requests"
on public.flash_requests for select to authenticated using (
  status = 'open'
  and expires_at > now()
  and exists (
    select 1
    from public.stores s
    where s.owner_id = (select auth.uid())
      and s.active
      and s.verified
      and s.zone = flash_requests.zone
      and s.category_tags @> array[flash_requests.category]
  )
);

create or replace function public.assert_vendor()
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
    where id = caller_id and role = 'vendor'
  ) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  return caller_id;
end;
$$;

create or replace function public.expire_flash_marketplace()
returns table (expired_requests integer, expired_offers integer)
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

  select role into caller_role
  from public.profiles
  where id = caller_id;
  if caller_role is null then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  with changed as (
    update public.flash_requests
    set status = 'expired'
    where status = 'open' and expires_at <= now()
    returning id
  )
  select count(*)::integer into expired_requests from changed;

  with changed as (
    update public.flash_offers fo
    set status = 'expired'
    from public.flash_requests fr
    where fr.id = fo.request_id
      and fo.status = 'open'
      and (fo.expires_at <= now() or fr.status = 'expired')
    returning fo.id
  )
  select count(*)::integer into expired_offers from changed;

  return next;
end;
$$;

create or replace function public.create_flash_request(
  p_item_name text,
  p_description text,
  p_category text,
  p_quantity integer,
  p_max_price numeric,
  p_urgency_minutes integer
)
returns public.flash_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  caller_zone text;
  created_request public.flash_requests;
begin
  caller_id := public.assert_customer();

  if char_length(trim(coalesce(p_item_name, ''))) not between 2 and 160 then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;
  if p_category not in (
    'Electronics', 'Stationery', 'Project Materials', 'Repair Essentials'
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;
  if p_max_price is not null and p_max_price < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;
  if p_urgency_minutes not in (30, 60, 120) then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;

  select zone into caller_zone from public.profiles where id = caller_id;

  insert into public.flash_requests (
    user_id, item_name, description, category, quantity, zone,
    max_price, urgency_minutes, status, expires_at
  )
  values (
    caller_id, trim(p_item_name), nullif(trim(p_description), ''), p_category,
    p_quantity, caller_zone, p_max_price, p_urgency_minutes, 'open',
    now() + make_interval(mins => p_urgency_minutes)
  )
  returning * into created_request;

  return created_request;
end;
$$;

create or replace function public.cancel_flash_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  request_row public.flash_requests;
begin
  caller_id := public.assert_customer();
  perform public.expire_flash_marketplace();

  select * into request_row
  from public.flash_requests
  where id = p_request_id
  for update;

  if not found or request_row.user_id <> caller_id then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND';
  end if;
  if request_row.status = 'expired' then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;
  if request_row.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'REQUEST_CLOSED';
  end if;

  update public.flash_requests set status = 'cancelled' where id = p_request_id;
  update public.flash_offers
  set status = 'rejected'
  where request_id = p_request_id and status = 'open';
end;
$$;

create or replace function public.upsert_flash_offer(
  p_request_id uuid,
  p_product_name text,
  p_quantity integer,
  p_unit_price numeric,
  p_note text,
  p_ready_minutes integer,
  p_expiration_minutes integer
)
returns public.flash_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  request_row public.flash_requests;
  vendor_store public.stores;
  existing_offer public.flash_offers;
  saved_offer public.flash_offers;
begin
  caller_id := public.assert_vendor();
  perform public.expire_flash_marketplace();

  if char_length(trim(coalesce(p_product_name, ''))) not between 2 and 160
    or p_quantity is null or p_quantity <= 0
    or p_unit_price is null or p_unit_price < 0
    or p_ready_minutes is null or p_ready_minutes <= 0
    or p_expiration_minutes is null or p_expiration_minutes not between 5 and 120
    or (p_note is not null and char_length(p_note) > 500)
  then
    raise exception using errcode = 'P0001', message = 'INVALID_OFFER';
  end if;

  select * into request_row
  from public.flash_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND';
  end if;
  if request_row.status = 'expired' or request_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;
  if request_row.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'REQUEST_CLOSED';
  end if;

  select s.* into vendor_store
  from public.stores s
  where s.owner_id = caller_id
    and s.active
    and s.verified
    and s.zone = request_row.zone
    and s.category_tags @> array[request_row.category]
  order by s.created_at, s.id
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'VENDOR_NOT_ELIGIBLE';
  end if;
  if p_quantity < request_row.quantity
    or (request_row.max_price is not null and p_unit_price > request_row.max_price)
  then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_ELIGIBLE';
  end if;

  select * into existing_offer
  from public.flash_offers
  where request_id = p_request_id and store_id = vendor_store.id
  for update;

  if found and existing_offer.status = 'accepted' then
    raise exception using errcode = 'P0001', message = 'OFFER_ALREADY_ACCEPTED';
  end if;

  insert into public.flash_offers (
    request_id, store_id, product_name, price, quantity, note,
    ready_minutes, status, expires_at
  )
  values (
    p_request_id, vendor_store.id, trim(p_product_name), p_unit_price,
    p_quantity, nullif(trim(p_note), ''), p_ready_minutes, 'open',
    least(
      request_row.expires_at,
      now() + make_interval(mins => p_expiration_minutes)
    )
  )
  on conflict (request_id, store_id)
  do update set
    product_name = excluded.product_name,
    price = excluded.price,
    quantity = excluded.quantity,
    note = excluded.note,
    ready_minutes = excluded.ready_minutes,
    status = 'open',
    expires_at = excluded.expires_at,
    created_at = now()
  returning * into saved_offer;

  return saved_offer;
end;
$$;

create or replace function public.withdraw_flash_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  offer_row public.flash_offers;
begin
  caller_id := public.assert_vendor();
  perform public.expire_flash_marketplace();

  select fo.* into offer_row
  from public.flash_offers fo
  join public.stores s on s.id = fo.store_id
  where fo.id = p_offer_id and s.owner_id = caller_id
  for update of fo;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;
  if offer_row.status = 'accepted' then
    raise exception using errcode = 'P0001', message = 'OFFER_ALREADY_ACCEPTED';
  end if;
  if offer_row.status = 'expired' then
    raise exception using errcode = 'P0001', message = 'OFFER_EXPIRED';
  end if;
  if offer_row.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'REQUEST_CLOSED';
  end if;

  update public.flash_offers set status = 'rejected' where id = p_offer_id;
end;
$$;

create or replace function public.accept_flash_offer(
  p_request_id uuid,
  p_offer_id uuid
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
  request_row public.flash_requests;
  offer_row public.flash_offers;
  computed_total numeric(12,2);
  new_order_id uuid;
  new_pickup_code text;
  new_expires_at timestamptz := now() + interval '30 minutes';
begin
  caller_id := public.assert_customer();
  perform public.expire_flash_marketplace();

  select * into request_row
  from public.flash_requests
  where id = p_request_id
  for update;

  if not found or request_row.user_id <> caller_id then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND';
  end if;
  if request_row.status = 'expired' or request_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
  end if;
  if request_row.status = 'fulfilled' then
    raise exception using errcode = 'P0001', message = 'OFFER_ALREADY_ACCEPTED';
  end if;
  if request_row.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'REQUEST_CLOSED';
  end if;

  perform id
  from public.flash_offers
  where request_id = p_request_id
  order by id
  for update;

  select * into offer_row
  from public.flash_offers
  where id = p_offer_id and request_id = p_request_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;
  if offer_row.status = 'expired' or offer_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'OFFER_EXPIRED';
  end if;
  if offer_row.status = 'accepted' then
    raise exception using errcode = 'P0001', message = 'OFFER_ALREADY_ACCEPTED';
  end if;
  if offer_row.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_ELIGIBLE';
  end if;
  if offer_row.quantity < request_row.quantity then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_ELIGIBLE';
  end if;

  computed_total := request_row.quantity * offer_row.price;

  loop
    new_pickup_code := public.generate_pickup_code();
    begin
      insert into public.orders (
        user_id, store_id, status, total, pickup_code, expires_at,
        flash_request_id, flash_offer_id
      )
      values (
        caller_id, offer_row.store_id, 'reserved', computed_total,
        new_pickup_code, new_expires_at, request_row.id, offer_row.id
      )
      returning id into new_order_id;
      exit;
    exception when unique_violation then
      if exists (
        select 1 from public.orders where flash_request_id = request_row.id
      ) then
        raise exception using
          errcode = 'P0001', message = 'OFFER_ALREADY_ACCEPTED';
      end if;
    end;
  end loop;

  insert into public.order_items (
    order_id, product_id, product_name, quantity, unit_price
  )
  values (
    new_order_id, null, offer_row.product_name,
    request_row.quantity, offer_row.price
  );

  update public.flash_offers
  set status = case
    when id = offer_row.id then 'accepted'::public.flash_offer_status
    else 'rejected'::public.flash_offer_status
  end
  where request_id = request_row.id and status = 'open';

  update public.flash_requests
  set status = 'fulfilled'
  where id = request_row.id;

  return query
  select new_order_id, computed_total, new_pickup_code, new_expires_at;
end;
$$;

revoke insert, update, delete on public.flash_requests from authenticated;
revoke insert, update, delete on public.flash_offers from authenticated;

revoke all on function public.assert_vendor() from public, anon, authenticated;
revoke all on function public.expire_flash_marketplace() from public, anon;
revoke all on function public.create_flash_request(text, text, text, integer, numeric, integer) from public, anon;
revoke all on function public.cancel_flash_request(uuid) from public, anon;
revoke all on function public.upsert_flash_offer(uuid, text, integer, numeric, text, integer, integer) from public, anon;
revoke all on function public.withdraw_flash_offer(uuid) from public, anon;
revoke all on function public.accept_flash_offer(uuid, uuid) from public, anon;

grant execute on function public.expire_flash_marketplace() to authenticated;
grant execute on function public.create_flash_request(text, text, text, integer, numeric, integer) to authenticated;
grant execute on function public.cancel_flash_request(uuid) to authenticated;
grant execute on function public.upsert_flash_offer(uuid, text, integer, numeric, text, integer, integer) to authenticated;
grant execute on function public.withdraw_flash_offer(uuid) to authenticated;
grant execute on function public.accept_flash_offer(uuid, uuid) to authenticated;

-- Supabase may assign explicit anon function grants in addition to PUBLIC.
-- Harden the inherited B2 commerce surface without modifying its migration.
revoke all on function public.assert_customer() from anon, authenticated;
revoke all on function public.generate_pickup_code() from anon, authenticated;
revoke all on function public.expire_reservations() from anon;
revoke all on function public.checkout_cart() from anon;
revoke all on function public.reserve_product(uuid, integer) from anon;
revoke all on function public.set_cart_item(uuid, integer, boolean) from anon;
revoke all on function public.remove_cart_item(uuid) from anon;
revoke all on function public.clear_cart() from anon;
