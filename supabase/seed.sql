-- Catalogue data is seeded by `npm run seed` because stores require genuine
-- auth.users owners. The migration idempotently creates the three lookup zones.
insert into public.zones (name)
values ('Anna Nagar'), ('T Nagar'), ('Velachery')
on conflict (name) do nothing;
