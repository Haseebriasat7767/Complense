-- Stripe subscription fields used by verified checkout webhooks.
alter table public.organizations
  add column if not exists "stripeCustomerId" text,
  add column if not exists "stripeSubscriptionId" text,
  add column if not exists "stripeSubscriptionStatus" text;

create unique index if not exists organizations_stripe_subscription_id_key
  on public.organizations ("stripeSubscriptionId")
  where "stripeSubscriptionId" is not null;
