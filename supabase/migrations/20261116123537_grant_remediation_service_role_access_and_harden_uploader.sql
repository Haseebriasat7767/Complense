-- Restore the server-side Data API permissions for remediation persistence.
-- The original application tables grant service_role CRUD access, but the
-- remediation tables were created without equivalent grants.
grant select, insert, update, delete on table
  public.remediations,
  public.remediation_events
to service_role;

-- The evidence uploader trigger is an internal implementation detail, not an
-- exposed RPC. Keep execution available to the trusted backend role only.
revoke execute on function public.enforce_evidence_uploader()
  from public, anon, authenticated;
grant execute on function public.enforce_evidence_uploader()
  to service_role;
