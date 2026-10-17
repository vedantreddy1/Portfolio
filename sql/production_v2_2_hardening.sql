-- Run once on existing V2 Supabase installations after reviewing the changes.
-- Safe to rerun; no data is deleted.
begin;
revoke update on public.portfolio_inquiries from authenticated;
grant update (status) on public.portfolio_inquiries to authenticated;
commit;
