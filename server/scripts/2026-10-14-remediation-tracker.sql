-- ComplyLens remediation tracker. Apply once to the Supabase project before enabling the API.
create table if not exists public.remediations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  control_id text not null,
  control_code text not null,
  title text not null,
  description text not null default '',
  owner text not null default '',
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','blocked','ready_for_review','verified','dismissed')),
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  required_proof text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz
);
create index if not exists remediations_org_workspace_updated_idx
  on public.remediations (organization_id, workspace_id, updated_at desc);
create table if not exists public.remediation_events (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  remediation_id text not null references public.remediations(id) on delete cascade,
  actor_id text not null,
  action text not null,
  detail text not null default '',
  at timestamptz not null default now()
);
create index if not exists remediation_events_record_at_idx
  on public.remediation_events (organization_id, workspace_id, remediation_id, at desc);
alter table public.remediations enable row level security;
alter table public.remediation_events enable row level security;
-- Server-side service credentials perform access-controlled operations; no anon/authenticated policies are added.
