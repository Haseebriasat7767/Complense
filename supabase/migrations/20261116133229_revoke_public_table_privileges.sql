-- Application tables are server-only. RLS remains enabled, and browser roles
-- receive no direct table privileges; the API enforces tenant scoping while
-- using the server-side service_role key.
revoke all privileges on table
  public.organizations,
  public.workspaces,
  public.users,
  public.evidence,
  public.reports,
  public.audit_events,
  public.remediations,
  public.remediation_events
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.organizations,
  public.workspaces,
  public.users,
  public.evidence,
  public.reports,
  public.audit_events,
  public.remediations,
  public.remediation_events
to service_role;

-- Keep tables and sequences created by the postgres migration role private
-- unless a later reviewed migration explicitly grants access.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
