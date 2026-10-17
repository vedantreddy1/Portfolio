-- Kawalpreet Studio V2 security migration.
-- Run sql/setup.sql FIRST, then this migration. Safe to rerun (except existing data is preserved).
-- IMPORTANT: Run in Supabase SQL Editor as project owner, never from the browser.
begin;

-- A preapproved address is NOT an editor until email verification + successful claim.
create table if not exists public.portfolio_editor_invites (
  email text primary key check (email = lower(trim(email)) and char_length(email) between 3 and 200),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.portfolio_editor_invites enable row level security;
revoke all on public.portfolio_editor_invites from anon, authenticated;
-- No select/insert/update/delete policy for visitors or editors.

create or replace function public.claim_portfolio_editor()
returns boolean language plpgsql security definer set search_path = '' as $$
declare verified_email text;
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.portfolio_editors where user_id = auth.uid()) then return true; end if;
  select lower(trim(email)) into verified_email from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then return false; end if;
  if not exists (
    select 1 from public.portfolio_editor_invites
    where email = verified_email and used_at is null and expires_at > now()
  ) then return false; end if;
  update public.portfolio_editor_invites set used_at = now()
  where email = verified_email and used_at is null and expires_at > now();
  if not found then return false; end if;
  insert into public.portfolio_editors (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.claim_portfolio_editor() from public, anon;
grant execute on function public.claim_portfolio_editor() to authenticated;

-- All private data operations require approved editor AND TOTP-verified session (aal2).
create or replace function public.is_portfolio_editor_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    and exists (select 1 from public.portfolio_editors e where e.user_id = auth.uid());
$$;
revoke all on function public.is_portfolio_editor_mfa() from public, anon;
grant execute on function public.is_portfolio_editor_mfa() to authenticated;

-- A public read is allowed; publishing is protected by MFA at the database layer.
drop policy if exists "Approved editors insert portfolio" on public.portfolio_content;
create policy "Approved editors insert portfolio" on public.portfolio_content
  for insert to authenticated with check ((select public.is_portfolio_editor_mfa()));
drop policy if exists "Approved editors update portfolio" on public.portfolio_content;
create policy "Approved editors update portfolio" on public.portfolio_content
  for update to authenticated
  using ((select public.is_portfolio_editor_mfa()))
  with check ((select public.is_portfolio_editor_mfa()));

-- Enquiries may only enter via Cloudflare Pages Function with a secret service-role key
-- after server-side Turnstile verification. Browser anon key cannot write.
drop policy if exists "Visitors can send enquiries" on public.portfolio_inquiries;
revoke insert on public.portfolio_inquiries from anon, authenticated;
grant insert on public.portfolio_inquiries to service_role;
-- Limit editor writes to status only. Enquiry text and sender details stay immutable.
revoke update on public.portfolio_inquiries from authenticated;
grant update (status) on public.portfolio_inquiries to authenticated;
drop policy if exists "Editors can read enquiries" on public.portfolio_inquiries;
create policy "Editors can read enquiries" on public.portfolio_inquiries
  for select to authenticated using ((select public.is_portfolio_editor_mfa()));
drop policy if exists "Editors can update enquiry statuses" on public.portfolio_inquiries;
create policy "Editors can update enquiry statuses" on public.portfolio_inquiries
  for update to authenticated
  using ((select public.is_portfolio_editor_mfa()))
  with check ((select public.is_portfolio_editor_mfa()));

-- Email-based rate limiting as a second line of defence after Turnstile.
-- No visitor IP addresses or Turnstile tokens are stored.
create or replace function public.portfolio_inquiry_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  perform pg_catalog.pg_advisory_xact_lock(29764, pg_catalog.hashtext(new.email));
  if exists (select 1 from public.portfolio_inquiries where email = new.email and created_at > now() - interval '60 seconds') then
    raise exception 'Too many enquiries' using errcode = '23514';
  end if;
  if (select count(*) from public.portfolio_inquiries where email = new.email and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Daily enquiry limit reached' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists portfolio_inquiry_throttle on public.portfolio_inquiries;
create trigger portfolio_inquiry_throttle before insert on public.portfolio_inquiries
  for each row execute function public.portfolio_inquiry_rate_limit();
create index if not exists portfolio_inquiries_email_created_idx on public.portfolio_inquiries (email, created_at desc);

-- Media: anyone can view intentionally public assets, only MFA editors can upload/delete.
drop policy if exists "Editors upload portfolio media" on storage.objects;
create policy "Editors upload portfolio media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portfolio-media' and (select public.is_portfolio_editor_mfa())
  );
drop policy if exists "Editors delete portfolio media" on storage.objects;
create policy "Editors delete portfolio media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'portfolio-media' and (select public.is_portfolio_editor_mfa())
  );

-- Example: approve an editor's email BEFORE they register:
-- insert into public.portfolio_editor_invites (email)
-- values ('her-real-email@example.com')
-- on conflict (email) do update set expires_at = now() + interval '14 days', used_at = null;
-- Then she registers at /studio, verifies her email, signs in, and enrolls TOTP.
-- To revoke access immediately:
-- delete from public.portfolio_editors where user_id = (select id from auth.users where email = 'her-real-email@example.com');
-- ALSO revoke active Supabase Auth sessions in Authentication > Users.

-- Optional but strongly recommended: enable this hook in Dashboard > Authentication > Hooks
-- > Before User Created > Postgres function > public.portfolio_before_user_created.
-- When enabled, even creating a Supabase Auth account requires a valid invitation.
-- Keep the hook disabled until at least one invitation exists, to avoid owner lockout.
create or replace function public.portfolio_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare requested_email text;
begin
  requested_email := lower(trim(coalesce(event->'user'->>'email','')));
  if not exists (
    select 1 from public.portfolio_editor_invites
    where email = requested_email and used_at is null and expires_at > now()
  ) then
    return pg_catalog.jsonb_build_object('error', pg_catalog.jsonb_build_object(
      'http_code', 403, 'message', 'This creator studio is invitation only.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.portfolio_before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.portfolio_before_user_created(jsonb) to supabase_auth_admin;

-- Revision history + optimistic concurrency (protects against accidental overwrite).
alter table public.portfolio_content add column if not exists version integer not null default 1;
create table if not exists public.portfolio_content_revisions (
  id bigint generated always as identity primary key,
  data jsonb not null,
  version integer not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
alter table public.portfolio_content_revisions enable row level security;
revoke all on public.portfolio_content_revisions from anon, authenticated;
grant select on public.portfolio_content_revisions to authenticated;
drop policy if exists "Editors with MFA read revisions" on public.portfolio_content_revisions;
create policy "Editors with MFA read revisions" on public.portfolio_content_revisions
  for select to authenticated using ((select public.is_portfolio_editor_mfa()));

create or replace function public.save_portfolio_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.data is distinct from new.data then
    insert into public.portfolio_content_revisions (data, version, changed_by)
    values (old.data, old.version, auth.uid());
    -- Keep the most recent 50 revisions; also export periodic off-site backups.
    delete from public.portfolio_content_revisions
    where id not in (select id from public.portfolio_content_revisions order by id desc limit 50);
  end if;
  return new;
end;
$$;
drop trigger if exists portfolio_revision_trigger on public.portfolio_content;
create trigger portfolio_revision_trigger before update on public.portfolio_content
  for each row execute function public.save_portfolio_revision();

create or replace function public.publish_portfolio(next_data jsonb, expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare current_version integer;
begin
  if not public.is_portfolio_editor_mfa() then
    raise exception 'Approved editor with MFA required' using errcode = '42501';
  end if;
  if expected_version is null or expected_version < 0 then
    raise exception 'Expected version required' using errcode = '22023';
  end if;
  if next_data is null or pg_catalog.jsonb_typeof(next_data) <> 'object'
     or pg_catalog.octet_length(next_data::text) > 500000 then
    raise exception 'Invalid or oversized content' using errcode = '22023';
  end if;
  -- Serialize concurrent first-time publishes.
  perform pg_catalog.pg_advisory_xact_lock(37129, 1);
  select version into current_version from public.portfolio_content where id = 1 for update;
  if not found then
    if expected_version <> 0 then raise exception 'Content changed: reload before publishing' using errcode = '40001'; end if;
    insert into public.portfolio_content (id, data, version, updated_at)
    values (1, next_data, 1, now());
    return 1;
  end if;
  if current_version <> expected_version then
    raise exception 'Content changed: reload before publishing' using errcode = '40001';
  end if;
  update public.portfolio_content set data = next_data, version = current_version + 1, updated_at = now() where id = 1;
  return current_version + 1;
end;
$$;
revoke all on function public.publish_portfolio(jsonb,integer) from public, anon;
grant execute on function public.publish_portfolio(jsonb,integer) to authenticated;
-- Disallow direct writes; all publishing goes through the version-checked RPC.
revoke insert, update on public.portfolio_content from authenticated;
drop policy if exists "Approved editors insert portfolio" on public.portfolio_content;
drop policy if exists "Approved editors update portfolio" on public.portfolio_content;

commit;
