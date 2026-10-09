-- ComplyLens Supabase PostgreSQL schema
-- Apply with Supabase SQL Editor or: supabase db push
-- All tables have RLS enabled and no public policies. The server uses a
-- server-only Supabase secret key and performs organization-scoped authorization.

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null,
  "primaryFramework" text not null,
  industry text not null default '',
  "employeeCount" integer not null default 0,
  "createdAt" text not null,
  settings jsonb not null default '{}'::jsonb
);

create table if not exists public.workspaces (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  name text not null,
  "isDemo" boolean not null default false,
  "isDefault" boolean not null default false,
  "createdAt" text not null,
  "ownerUserId" text not null
);
create index if not exists workspaces_org_created_idx on public.workspaces ("organizationId", "createdAt");

create table if not exists public.users (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  email text not null,
  name text not null,
  "jobTitle" text not null default '',
  role text not null,
  "isDemoUser" boolean not null default false,
  "passwordHash" text not null,
  "createdAt" text not null,
  "lastLoginAt" text
);
create unique index if not exists users_email_lower_unique on public.users (lower(email));
create index if not exists users_org_idx on public.users ("organizationId");

create table if not exists public.evidence (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  "workspaceId" text not null references public.workspaces(id) on delete cascade,
  "fileName" text not null,
  "fileExtension" text not null,
  "mimeType" text not null,
  "sizeBytes" bigint not null default 0,
  category text not null default '',
  source text not null,
  "sourceRef" text,
  "uploadedAt" text not null,
  "uploadedBy" text not null,
  status text not null,
  "frameworkKeys" text[] not null default '{}',
  content text not null default '',
  summary text not null default '',
  "sizeOnDisk" bigint,
  "createdByUser" text
);
create index if not exists evidence_org_workspace_uploaded_idx on public.evidence ("organizationId", "workspaceId", "uploadedAt" desc);

create table if not exists public.reports (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  "workspaceId" text not null references public.workspaces(id) on delete cascade,
  name text not null,
  "frameworkKey" text not null,
  "companyName" text not null,
  "fileName" text not null,
  "generatedAt" text not null,
  status text not null,
  "scoreIndex" numeric not null default 0,
  summary jsonb not null default '{}'::jsonb,
  "requestedBy" text not null
);
create index if not exists reports_org_workspace_generated_idx on public.reports ("organizationId", "workspaceId", "generatedAt" desc);

create table if not exists public.audit_events (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  actor text not null,
  action text not null,
  target text not null,
  at text not null
);
create index if not exists audit_events_org_at_idx on public.audit_events ("organizationId", "at" desc);

alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;
alter table public.users enable row level security;
alter table public.evidence enable row level security;
alter table public.reports enable row level security;
alter table public.audit_events enable row level security;

-- Deliberately no anon/authenticated policies. Client access must go through
-- the authenticated ComplyLens server; its secret key is never sent to browsers.
