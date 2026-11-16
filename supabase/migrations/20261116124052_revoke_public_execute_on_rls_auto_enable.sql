-- The ensure_rls DDL event trigger invokes this helper automatically.
-- It is not a PostgREST RPC and must not be callable by API roles.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
