-- Add direct lookup indexes for foreign keys used by workspace-scoped reads
-- and remediation event history. These complement the composite tenant indexes.
create index if not exists evidence_workspace_id_idx
  on public.evidence ("workspaceId");

create index if not exists remediation_events_remediation_id_idx
  on public.remediation_events (remediation_id);

create index if not exists remediation_events_workspace_id_idx
  on public.remediation_events (workspace_id);

create index if not exists reports_workspace_id_idx
  on public.reports ("workspaceId");
