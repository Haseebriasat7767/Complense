-- =============================================================================
-- ComplyLens AI — core schema (Supabase PostgreSQL)
-- =============================================================================
-- Replaces the previous MongoDB collections one-for-one. Identifiers are TEXT,
-- not UUID, because the application already generates readable prefixed ids
-- (`org_acmecloud`, `ws_acmecloud_demo`, `usr-demo-owner`, `ev-demo-<key>`,
-- `org-<hex>`, `rpt-<hex>`, `aud-<hex>`) and those ids are part of the public
-- API contract and of the deterministic demo seed. Changing them to UUID would
-- break API responses, the seed and existing client state.
--
-- Timestamps are TIMESTAMPTZ. The server adapter converts them back to the
-- exact ISO-8601 `YYYY-MM-DDTHH:MM:SS.sssZ` strings the API has always
-- returned, so no response shape changes.
--
-- Security model: the backend connects with the Supabase *secret* (service
-- role) key, which bypasses RLS. RLS is enabled with deny-by-default on every
-- table and all privileges are revoked from `anon` and `authenticated`, so the
-- Data API exposes nothing to a browser even if the publishable key leaks.
-- Organisation/workspace isolation is enforced server-side in every query
-- (see server/src/store/supabase.ts) and additionally by the restrictive
-- policies below.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- updated_at housekeeping
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id                text primary key,
  name              text        not null,
  slug              text        not null,
  plan              text        not null default 'starter'
                      check (plan in ('starter', 'growth', 'business')),
  primary_framework text        not null default 'soc2'
                      check (primary_framework in ('soc2', 'iso27001')),
  industry          text        not null default 'Not specified',
  employee_count    integer     not null default 0 check (employee_count >= 0),
  created_at        timestamptz not null default now(),
  settings          jsonb       not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);

-- Slugs are derived from the organisation name and are NOT unique: two
-- customers may legitimately sign up with the same company name.
create index if not exists organizations_slug_idx on public.organizations (slug);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspaces
-- -----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id              text primary key,
  organization_id text        not null
                    references public.organizations (id) on delete cascade,
  name            text        not null,
  is_demo         boolean     not null default false,
  is_default      boolean     not null default false,
  created_at      timestamptz not null default now(),
  -- No FK to users: `createAccount` inserts the workspace before its owner,
  -- and the demo seed reuses a fixed owner id. Ownership is validated in the
  -- application layer.
  owner_user_id   text        not null default '',
  updated_at      timestamptz not null default now()
);

create index if not exists workspaces_organization_idx
  on public.workspaces (organization_id, created_at);

-- The application assumes at most one default workspace per organisation
-- (`workspaces.find(w => w.isDefault)`). Enforce that invariant in the database.
create unique index if not exists workspaces_one_default_per_org
  on public.workspaces (organization_id)
  where is_default;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id              text primary key,
  organization_id text        not null
                    references public.organizations (id) on delete cascade,
  email           text        not null,
  name            text        not null,
  job_title       text        not null default '',
  role            text        not null default 'member'
                    check (role in ('owner', 'admin', 'member')),
  is_demo_user    boolean     not null default false,
  -- scrypt digest produced by server/src/auth/passwords.ts
  -- (format: scrypt$N$r$p$salt$hash). Never a plaintext password.
  password_hash   text        not null,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz,
  updated_at      timestamptz not null default now()
);

-- Email is the login identifier and must be globally unique, case-insensitively.
create unique index if not exists users_email_lower_key
  on public.users (lower(email));

create index if not exists users_organization_idx on public.users (organization_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- evidence
-- -----------------------------------------------------------------------------
create table if not exists public.evidence (
  id              text primary key,
  organization_id text        not null
                    references public.organizations (id) on delete cascade,
  workspace_id    text        not null
                    references public.workspaces (id) on delete cascade,
  file_name       text        not null,
  file_extension  text        not null default '',
  mime_type       text        not null default 'application/octet-stream',
  size_bytes      bigint      not null default 0 check (size_bytes >= 0),
  category        text        not null default 'Uncategorised',
  source          text        not null default 'upload'
                    check (source in ('demo', 'upload')),
  source_ref      text,
  uploaded_at     timestamptz not null default now(),
  uploaded_by     text        not null default '',
  status          text        not null default 'analyzing'
                    check (status in ('analyzed', 'analyzing', 'needs_review', 'failed')),
  framework_keys  text[]      not null default '{}'::text[],
  -- Extracted text retained for the deterministic analysis engine.
  content         text        not null default '',
  summary         text        not null default '',
  size_on_disk    bigint,
  created_by_user text,
  -- Original uploaded bytes live in Supabase Storage (private bucket); only the
  -- object reference is stored here. Never the file bytes themselves.
  storage_bucket  text,
  storage_path    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint evidence_framework_keys_valid
    check (framework_keys <@ array['soc2', 'iso27001']::text[])
);

create index if not exists evidence_workspace_idx
  on public.evidence (organization_id, workspace_id, uploaded_at desc);

create index if not exists evidence_status_idx
  on public.evidence (organization_id, status);

create unique index if not exists evidence_storage_path_key
  on public.evidence (storage_path)
  where storage_path is not null;

drop trigger if exists evidence_set_updated_at on public.evidence;
create trigger evidence_set_updated_at
  before update on public.evidence
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id              text primary key,
  organization_id text        not null
                    references public.organizations (id) on delete cascade,
  workspace_id    text        not null
                    references public.workspaces (id) on delete cascade,
  name            text        not null,
  framework_key   text        not null
                    check (framework_key in ('soc2', 'iso27001')),
  company_name    text        not null default '',
  file_name       text        not null default '',
  generated_at    timestamptz not null default now(),
  status          text        not null default 'ready'
                    check (status in ('generating', 'ready', 'failed')),
  score_index     integer     not null default 0
                    check (score_index between 0 and 100),
  summary         jsonb       not null default '{}'::jsonb,
  requested_by    text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists reports_workspace_idx
  on public.reports (organization_id, workspace_id, generated_at desc);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_events
-- -----------------------------------------------------------------------------
-- No FK on organization_id on purpose: the account-enumeration-safe
-- `POST /api/auth/forgot-password` records an event with organization_id
-- 'unknown' when the address does not exist. A FK there would leak account
-- existence through a write failure.
create table if not exists public.audit_events (
  id              text primary key,
  organization_id text        not null,
  actor           text        not null default '',
  action          text        not null,
  target          text        not null default '',
  at              timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists audit_events_organization_idx
  on public.audit_events (organization_id, at desc);

-- =============================================================================
-- Row Level Security — deny by default for every Data API role
-- =============================================================================
alter table public.organizations enable row level security;
alter table public.workspaces    enable row level security;
alter table public.users         enable row level security;
alter table public.evidence      enable row level security;
alter table public.reports       enable row level security;
alter table public.audit_events  enable row level security;

-- Remove the default Data API grants. Without these, PostgREST cannot even see
-- the tables for the anonymous/publishable key or for a signed-in Supabase Auth
-- user. ComplyLens never talks to Supabase from the browser.
--
-- RLS is ENABLED but deliberately not FORCED: the backend's `service_role`
-- bypasses RLS (documented, server-only), and the one-time Mongo import script
-- plus the SQL editor connect as the table owner. Forcing RLS would break both
-- without adding protection against the threat that matters here (a leaked
-- browser key reaching PostgREST as anon/authenticated).
do $$
declare
  role_name text;
  tbl text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      foreach tbl in array array['organizations', 'workspaces', 'users', 'evidence', 'reports', 'audit_events']
      loop
        execute format('revoke all on public.%I from %I', tbl, role_name);
      end loop;
    end if;
  end loop;
end;
$$;

-- Belt and braces: an explicit RESTRICTIVE policy that can never be satisfied
-- by a browser role. RESTRICTIVE policies are AND-ed with every permissive
-- policy, so even if a future migration accidentally adds a permissive policy
-- for anon/authenticated, rows stay invisible unless the request carries a
-- verified organisation claim issued by this application.
--
-- `request.complylens_org` is a server-set GUC. It is only ever set by a
-- privileged backend connection that has already authenticated the session
-- token and resolved the organisation, which keeps organisation/workspace
-- isolation enforced in the database as well as in the application.
do $$
declare
  tbl text;
  org_column text;
begin
  foreach tbl in array array['organizations', 'workspaces', 'users', 'evidence', 'reports', 'audit_events']
  loop
    org_column := case when tbl = 'organizations' then 'id' else 'organization_id' end;

    execute format('drop policy if exists %I on public.%I', tbl || '_org_isolation', tbl);
    execute format(
      'create policy %I on public.%I as restrictive to public using (%I = current_setting(''request.complylens_org'', true)) with check (%I = current_setting(''request.complylens_org'', true))',
      tbl || '_org_isolation', tbl, org_column, org_column
    );
  end loop;
end;
$$;

comment on table public.organizations is 'Customer organisations. Root of the tenancy boundary.';
comment on table public.workspaces    is 'Workspaces belong to exactly one organisation (cascade delete).';
comment on table public.users         is 'Application users. password_hash is a scrypt digest, never plaintext.';
comment on table public.evidence      is 'Evidence metadata + extracted text. Original bytes live in the private Storage bucket referenced by storage_bucket/storage_path.';
comment on table public.reports       is 'Frozen readiness report snapshots (summary jsonb).';
comment on table public.audit_events  is 'Append-only audit trail. organization_id has no FK so account enumeration is impossible.';
