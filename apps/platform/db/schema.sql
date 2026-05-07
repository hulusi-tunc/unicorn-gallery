-- Unicorn Studio Gallery — initial schema
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('agency', 'customer');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — public mirror of auth.users with role + display name
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now()
);
-- Display-only flavor label (designer | non-designer). No permission impact.
alter table public.profiles add column if not exists flavor text;

-- Pending role assignments — when an agency user signs up via /sign-up
-- with a valid invite code, we record (email -> 'agency') here. The
-- handle_new_user trigger consumes this and applies the role.
create table if not exists public.pending_role_assignments (
  email text primary key,
  role public.app_role not null,
  created_at timestamptz not null default now()
);
alter table public.pending_role_assignments enable row level security;
drop policy if exists pending_role_agency on public.pending_role_assignments;
create policy pending_role_agency on public.pending_role_assignments for all
  using (public.is_agency()) with check (public.is_agency());

-- Auto-create a profile when a new auth.users row is inserted. Consumes
-- pending_role_assignments for first-time signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_role public.app_role;
begin
  select role into pending_role
    from public.pending_role_assignments
   where email = new.email
   limit 1;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    coalesce(pending_role, 'customer')
  )
  on conflict (id) do update
    set email = excluded.email,
        role = coalesce(pending_role, public.profiles.role);

  if pending_role is not null then
    delete from public.pending_role_assignments where email = new.email;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- apps — the customer products we are gallerying
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  icon_url text,
  platform text not null check (platform in ('web', 'ios', 'android')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.apps add column if not exists project_token text unique;
alter table public.apps add column if not exists preview_image_url text;
alter table public.apps add column if not exists accent_color text;

-- ─────────────────────────────────────────────────────────────────────────────
-- app_customers — customers can only see apps they're added to
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_customers (
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (app_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- invites — pending customer invites by email
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  token text unique not null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (app_id, email)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- builds — one row per CI run / manual upload
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.builds (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  sha text not null,
  captured_at timestamptz not null,
  platform text not null,
  manifest jsonb not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists builds_app_idx on public.builds(app_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- frames — derived from manifest, stable across builds.
-- Comments live on frame.id, so they survive screenshot updates.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.frames (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  flow_id text not null,
  frame_id text not null,
  flow_name text not null,
  frame_name text not null,
  latest_image_url text,
  latest_build_id uuid references public.builds(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (app_id, flow_id, frame_id)
);
create index if not exists frames_app_flow_idx on public.frames(app_id, flow_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- comments — threaded per frame
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.frames(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) < 10000),
  pin_x real check (pin_x is null or (pin_x >= 0 and pin_x <= 1)),
  pin_y real check (pin_y is null or (pin_y >= 0 and pin_y <= 1)),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists comments_frame_idx on public.comments(frame_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'agency' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_app_customer(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.app_customers
    where app_id = p_app_id and user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.app_customers enable row level security;
alter table public.invites enable row level security;
alter table public.builds enable row level security;
alter table public.frames enable row level security;
alter table public.comments enable row level security;

-- profiles: read self or all-if-agency; update self only
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (auth.uid() = id or public.is_agency());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (auth.uid() = id);

-- apps: agency sees all; customer sees only invited
drop policy if exists apps_select on public.apps;
create policy apps_select on public.apps for select
  using (public.is_agency() or public.is_app_customer(id));

drop policy if exists apps_agency_write on public.apps;
create policy apps_agency_write on public.apps for all
  using (public.is_agency()) with check (public.is_agency());

-- app_customers: agency manages; customer can see own row
drop policy if exists app_customers_select on public.app_customers;
create policy app_customers_select on public.app_customers for select
  using (public.is_agency() or user_id = auth.uid());

drop policy if exists app_customers_agency_write on public.app_customers;
create policy app_customers_agency_write on public.app_customers for all
  using (public.is_agency()) with check (public.is_agency());

-- invites: agency manages; everyone else blocked
drop policy if exists invites_agency on public.invites;
create policy invites_agency on public.invites for all
  using (public.is_agency()) with check (public.is_agency());

-- builds: visible if app is visible to user, hide is_visible=false from customers
drop policy if exists builds_select on public.builds;
create policy builds_select on public.builds for select
  using (
    public.is_agency()
    or (is_visible = true and public.is_app_customer(app_id))
  );

drop policy if exists builds_agency_write on public.builds;
create policy builds_agency_write on public.builds for all
  using (public.is_agency()) with check (public.is_agency());

-- frames: visible if user can see the app
drop policy if exists frames_select on public.frames;
create policy frames_select on public.frames for select
  using (public.is_agency() or public.is_app_customer(app_id));

drop policy if exists frames_agency_write on public.frames;
create policy frames_agency_write on public.frames for all
  using (public.is_agency()) with check (public.is_agency());

-- comments: anyone who can see the frame can read; anyone authenticated who can see the frame can write
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select
  using (
    exists(
      select 1 from public.frames f
      where f.id = comments.frame_id
        and (public.is_agency() or public.is_app_customer(f.app_id))
    )
  );

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists(
      select 1 from public.frames f
      where f.id = comments.frame_id
        and (public.is_agency() or public.is_app_customer(f.app_id))
    )
  );

drop policy if exists comments_author_update on public.comments;
create policy comments_author_update on public.comments for update
  using (author_id = auth.uid());

drop policy if exists comments_author_delete on public.comments;
create policy comments_author_delete on public.comments for delete
  using (author_id = auth.uid() or public.is_agency());
