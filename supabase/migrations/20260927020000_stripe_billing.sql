-- Stripe is the source of truth for payment state. Only Edge Functions using the
-- service-role key may write these tables; browser clients may only read their own data.
alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists latest_invoice_id text,
  add column if not exists ended_at timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (
  status in ('inactive', 'trialing', 'active', 'past_due', 'unpaid', 'incomplete',
             'incomplete_expired', 'paused', 'cancelled')
);
create unique index if not exists subscriptions_stripe_subscription_id_key
  on public.subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  stripe_invoice_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text,
  status text not null,
  amount_paid bigint not null default 0,
  currency text,
  hosted_invoice_url text,
  invoice_pdf text,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vpn_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan text check (plan in ('monthly', 'yearly')),
  active boolean not null default false,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Stores delivery state, not complete Stripe payloads, to minimize retained payment data.
create table if not exists public.stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_customers enable row level security;
alter table public.invoices enable row level security;
alter table public.vpn_entitlements enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.billing_customers, public.invoices, public.vpn_entitlements, public.stripe_events from anon, authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
grant select on public.invoices, public.vpn_entitlements to authenticated;
create policy "Users can view their own invoices" on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view their own VPN entitlement" on public.vpn_entitlements for select to authenticated using ((select auth.uid()) = user_id);
