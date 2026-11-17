-- Persist each organisation's no-card 14-day trial window.
alter table public.organizations
  add column if not exists "trialStartedAt" text,
  add column if not exists "trialEndsAt" text;

-- Existing organisations receive a trial window from their original creation date.
update public.organizations
set "trialStartedAt" = coalesce("trialStartedAt", "createdAt"),
    "trialEndsAt" = coalesce("trialEndsAt", ("createdAt"::timestamptz + interval '14 days')::text)
where "trialStartedAt" is null or "trialEndsAt" is null;
