-- Make every open Flash Request discoverable to every authenticated vendor.
-- Stores must still be active and verified before they can submit an offer.

drop policy if exists "eligible vendors read open local flash requests"
  on public.flash_requests;

create policy "vendors read all open flash requests"
on public.flash_requests for select to authenticated using (
  status = 'open'
  and expires_at > now()
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'vendor'
  )
);

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

revoke all on function public.upsert_flash_offer(
  uuid, text, integer, numeric, text, integer, integer
) from public, anon;
grant execute on function public.upsert_flash_offer(
  uuid, text, integer, numeric, text, integer, integer
) to authenticated;
