-- ComplyLens: Free plan + reusable questionnaire library
-- Apply with the Supabase SQL Editor or: supabase db push
-- All tables have RLS enabled and no public policies. The server uses a
-- server-only Supabase secret key and performs organization-scoped
-- authorization in the API layer, exactly like the existing tables.
--
-- Free plan note: no schema change is needed for the Free plan itself.
-- Plan limits live in server/src/billing/entitlements.ts and are enforced
-- in the API from counts of the existing tables. New signups default to
-- plan 'free'; a cancelled subscription now falls back to 'free'.

create table if not exists public.questionnaire_answers (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  "workspaceId" text not null references public.workspaces(id) on delete cascade,
  "questionSlug" text not null,
  framework text not null,
  question text not null,
  answer text not null default '',
  status text not null default 'draft',
  "sourceEvidenceIds" text[] not null default '{}',
  "updatedBy" text not null default '',
  "createdAt" text not null,
  "updatedAt" text not null
);
create unique index if not exists questionnaire_answers_org_slug_unique
  on public.questionnaire_answers ("organizationId", "questionSlug");
create index if not exists questionnaire_answers_org_updated_idx
  on public.questionnaire_answers ("organizationId", "updatedAt" desc);

create table if not exists public.questionnaires (
  id text primary key,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  "workspaceId" text not null references public.workspaces(id) on delete cascade,
  title text not null,
  requester text not null default '',
  status text not null default 'draft',
  "createdAt" text not null,
  "updatedAt" text not null
);
create index if not exists questionnaires_org_updated_idx
  on public.questionnaires ("organizationId", "updatedAt" desc);

create table if not exists public.questionnaire_items (
  id text primary key,
  "questionnaireId" text not null references public.questionnaires(id) on delete cascade,
  "organizationId" text not null references public.organizations(id) on delete cascade,
  "questionSlug" text,
  "customQuestion" text,
  framework text not null,
  category text not null default '',
  question text not null,
  answer text,
  "answerSource" text not null default 'none',
  "reuseConfirmed" boolean not null default false,
  "libraryAnswerId" text,
  status text not null default 'unanswered',
  "createdAt" text not null,
  "updatedAt" text not null
);
create index if not exists questionnaire_items_questionnaire_idx
  on public.questionnaire_items ("questionnaireId", "createdAt");

alter table public.questionnaire_answers enable row level security;
alter table public.questionnaires enable row level security;
alter table public.questionnaire_items enable row level security;
