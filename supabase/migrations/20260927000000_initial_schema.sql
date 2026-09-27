-- Nutag VPN demo schema. Apply in the Supabase SQL Editor or via the CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connection_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  server_location text not null default 'Ulaanbaatar, MN',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint connection_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists connection_sessions_one_active_per_user
  on public.connection_sessions(user_id) where ended_at is null;
create index if not exists subscriptions_user_created_idx
  on public.subscriptions(user_id, created_at desc);
create index if not exists connection_sessions_user_started_idx
  on public.connection_sessions(user_id, started_at desc);

-- Create a profile server-side so email-confirmation flows work before a browser session exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.connection_sessions enable row level security;

revoke all on public.profiles, public.subscriptions, public.connection_sessions from anon;
revoke all on public.profiles, public.subscriptions, public.connection_sessions from authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.subscriptions to authenticated;
grant select, insert, update on public.connection_sessions to authenticated;

create policy "Users can view their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can view their own subscriptions" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can record inactive plan interest" on public.subscriptions for insert to authenticated with check ((select auth.uid()) = user_id and status = 'inactive');
create policy "Users can view their own connection sessions" on public.connection_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can start their own connection session" on public.connection_sessions for insert to authenticated with check ((select auth.uid()) = user_id and ended_at is null and server_location = 'Ulaanbaatar, MN');
create policy "Users can end their own connection session" on public.connection_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The trigger invokes this function; no API role should call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

