-- READ-ONLY checks after running setup.sql and production_v2.sql.
-- Run in Supabase SQL Editor. Review results; do not paste credentials.

-- 1) Expected: no anon INSERT privilege on private enquiries.
select has_table_privilege('anon', 'public.portfolio_inquiries', 'INSERT') as anon_can_insert_inquiries,
       has_table_privilege('anon', 'public.portfolio_inquiries', 'SELECT') as anon_can_read_inquiries,
       has_table_privilege('authenticated', 'public.portfolio_content', 'UPDATE') as auth_can_directly_update_content;
-- All three columns should be FALSE.

-- 2) Expected: RLS enabled on all four tables.
select n.nspname as schemaname, c.relname as tablename, c.relrowsecurity as rowsecurity
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
 'portfolio_editors','portfolio_editor_invites','portfolio_content','portfolio_content_revisions','portfolio_inquiries'
);

-- 3) Review active policies, including mandatory MFA.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename like 'portfolio_%'
order by tablename, policyname;

-- 4) Expected: only approved editor sessions with AAL2 can publish via RPC.
-- Actual permission tests must be run from an anon client and a real signed-in user.
select proname, prosecdef as security_definer
from pg_catalog.pg_proc
where proname in ('claim_portfolio_editor','is_portfolio_editor_mfa','publish_portfolio','portfolio_before_user_created');
