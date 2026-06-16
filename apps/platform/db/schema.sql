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
-- Avatar URL stored in Supabase Storage (avatars bucket). Public URL.
alter table public.profiles add column if not exists avatar_url text;
-- All agency users have equal permissions. Drop the legacy is_admin tier.
alter table public.profiles drop column if exists is_admin;

-- Keep the founder pinned to agency role so we never lock ourselves out.
update public.profiles set role = 'agency'
  where email = 'hulusitunc1@gmail.com';

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
-- Project staffing — any agency user can change these via apps_agency_write RLS.
alter table public.apps add column if not exists designer_id uuid references public.profiles(id) on delete set null;
alter table public.apps add column if not exists pm_id uuid references public.profiles(id) on delete set null;
create index if not exists apps_designer_idx on public.apps(designer_id);
create index if not exists apps_pm_idx on public.apps(pm_id);
-- Optional public-share token. NULL = private (default); non-null = anyone with
-- the token URL can view this app read-only at /shared/<token>.
alter table public.apps add column if not exists public_share_token text unique;
create index if not exists apps_public_share_token_idx on public.apps(public_share_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- Archive lifecycle (soft-delete with 90-day grace period)
--
-- archived_at is set by /api/projects/:slug/archive. While non-null, the app
-- is hidden from default queries (lists, dashboards) but its rows + storage
-- stay intact so users can /restore within the grace window. A daily cron
-- hard-deletes apps whose archived_at is older than 90 days.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.apps add column if not exists archived_at timestamptz;
alter table public.apps add column if not exists archive_reason text;
alter table public.apps add column if not exists archived_by uuid references public.profiles(id) on delete set null;
create index if not exists apps_archived_at_idx on public.apps(archived_at) where archived_at is not null;

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

-- Per-app version number — stable, monotonic, human-friendly (v1, v2, ...).
alter table public.builds add column if not exists version int;
-- Optional human note shown in version history (e.g. "Added booking flow").
alter table public.builds add column if not exists message text;
create unique index if not exists builds_app_version_uq
  on public.builds(app_id, version) where version is not null;
-- Full flow hierarchy for this build, INCLUDING grouping flows that hold no
-- frames of their own (e.g. "ADMIN" containing sub-flows). Frames alone can't
-- represent an empty container, so we'd otherwise lose the nesting and flatten
-- its children to the top level. Accumulated across chunked upload batches.
-- Shape: [{ id, name, parentFlowId, position }]
alter table public.builds add column if not exists flow_tree jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- frame_versions — per-build snapshot of every frame. Powers version history
-- diff (added / updated / renamed / unchanged) without rereading manifests.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.frame_versions (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.builds(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  flow_id text not null,
  frame_id text not null,
  flow_name text not null,
  frame_name text not null,
  image_url text not null,
  change_kind text not null check (change_kind in ('added','updated','renamed','unchanged','removed')),
  created_at timestamptz not null default now(),
  unique (build_id, flow_id, frame_id)
);
create index if not exists frame_versions_build_idx on public.frame_versions(build_id);
create index if not exists frame_versions_app_idx on public.frame_versions(app_id, created_at desc);

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

-- Sub-flow nesting — `parent_flow_id` references another flow_id within
-- the same app. Null = top-level flow. Capture's per-route auto-grouping
-- detects parent paths (e.g. `/profile/profile-edit` nests under `/profile`).
alter table public.frames add column if not exists parent_flow_id text;
create index if not exists frames_app_parent_flow_idx
  on public.frames(app_id, parent_flow_id);

-- Display ordering — `flow_position` is the flow's index among siblings
-- (small = earlier), `frame_position` is the frame's index inside its flow.
-- Capture-side drag-and-drop assigns these so the web view matches the
-- desktop view exactly.
alter table public.frames add column if not exists flow_position int;
alter table public.frames add column if not exists frame_position int;

-- ─────────────────────────────────────────────────────────────────────────────
-- frame_captures — per-frame intra-build version history.
--
-- Mirrors Capture's snap.versions[] array: when a designer re-snaps the
-- same screen multiple times before pushing, each prior capture lands here
-- so reviewers on the web side can scrub through the iteration history.
-- Distinct from `frame_versions` which is inter-build (one row per build).
--
-- `idx` is 0 for the latest (matches the in-bucket "current" image), 1+
-- for past captures (newest-first, like Capture's lightbox scrubber).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.frame_captures (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.frames(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  build_id uuid references public.builds(id) on delete set null,
  image_url text not null,
  captured_at timestamptz not null,
  idx int not null,
  created_at timestamptz not null default now()
);
create index if not exists frame_captures_frame_idx on public.frame_captures(frame_id, idx);
create index if not exists frame_captures_app_idx on public.frame_captures(app_id);

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

drop function if exists public.is_admin();

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
alter table public.frame_versions enable row level security;
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

-- frame_versions: same visibility as frames; only agency writes
drop policy if exists frame_versions_select on public.frame_versions;
create policy frame_versions_select on public.frame_versions for select
  using (public.is_agency() or public.is_app_customer(app_id));

drop policy if exists frame_versions_agency_write on public.frame_versions;
create policy frame_versions_agency_write on public.frame_versions for all
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

-- Agency members can update any comment they can see (currently used to
-- toggle resolved_at / resolved_by). Without this policy the resolve
-- action silently affects 0 rows for non-author agency users.
drop policy if exists comments_agency_update on public.comments;
create policy comments_agency_update on public.comments for update
  using (public.is_agency()) with check (public.is_agency());

drop policy if exists comments_author_delete on public.comments;
create policy comments_author_delete on public.comments for delete
  using (author_id = auth.uid() or public.is_agency());

-- ─────────────────────────────────────────────────────────────────────────────
-- frame_reads — last time each user opened a given frame. Used to compute
-- which comments are "unread" for indicator badges.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.frame_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  frame_id uuid not null references public.frames(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, frame_id)
);
create index if not exists frame_reads_user_idx on public.frame_reads(user_id, last_read_at desc);

alter table public.frame_reads enable row level security;
drop policy if exists frame_reads_self on public.frame_reads;
create policy frame_reads_self on public.frame_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications — one row per recipient per relevant event. Inserted by
-- a trigger on comments.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type public.notification_kind as enum ('comment', 'mention', 'reply');
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  comment_id uuid not null references public.comments(id) on delete cascade,
  frame_id uuid not null references public.frames(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
-- Drop legacy email digest column if it lingered from a prior migration.
alter table public.notifications drop column if exists emailed_at;
create index if not exists notifications_user_unseen_idx
  on public.notifications(user_id, created_at desc) where seen_at is null;
create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_self_select on public.notifications;
create policy notifications_self_select on public.notifications for select
  using (user_id = auth.uid());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trigger: when a comment lands, fan out notification rows to every
-- agency user + every customer linked to the comment's app. Skip the
-- comment's author (no self-pings). Mentions are layered on top in
-- application code (server action also inserts 'mention' rows for
-- explicit @mentions parsed from the body).
create or replace function public.fanout_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id uuid;
  v_parent_author uuid;
begin
  -- Resolve app_id from the frame.
  select app_id into v_app_id from public.frames where id = new.frame_id;
  if v_app_id is null then
    return new;
  end if;

  -- Reply: notify the parent comment's author (if not self).
  if new.parent_id is not null then
    select author_id into v_parent_author from public.comments where id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications (user_id, kind, comment_id, frame_id, app_id, actor_id)
      values (v_parent_author, 'reply', new.id, new.frame_id, v_app_id, new.author_id);
    end if;
  end if;

  -- Generic 'comment' notification to every agency user (excluding author + parent author).
  insert into public.notifications (user_id, kind, comment_id, frame_id, app_id, actor_id)
  select p.id, 'comment', new.id, new.frame_id, v_app_id, new.author_id
    from public.profiles p
    where p.role = 'agency'
      and p.id <> new.author_id
      and (v_parent_author is null or p.id <> v_parent_author);

  -- And every customer linked to this app (excluding author + parent author).
  insert into public.notifications (user_id, kind, comment_id, frame_id, app_id, actor_id)
  select ac.user_id, 'comment', new.id, new.frame_id, v_app_id, new.author_id
    from public.app_customers ac
    where ac.app_id = v_app_id
      and ac.user_id <> new.author_id
      and (v_parent_author is null or ac.user_id <> v_parent_author);

  return new;
end;
$$;

drop trigger if exists comments_fanout on public.comments;
create trigger comments_fanout
  after insert on public.comments
  for each row execute function public.fanout_comment_notifications();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime — opt these tables into Supabase's realtime publication so the
-- web app can subscribe to live INSERT/UPDATE events for comments + bell.
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    execute 'alter publication supabase_realtime add table public.comments';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- dor_assessments — Definition of Ready self-checks. Designers score the PM
-- handoff against weighted criteria before starting design. The team sees the
-- full history. `score` + `verdict` are recomputed server-side on every write
-- (see lib/dor/criteria.ts) — the client value is never trusted.
--
-- app_id optionally ties an assessment to a real gallery project; it's nullable
-- so a check can run before the project is onboarded. project_name is kept
-- denormalized so history reads don't have to join (and survives app deletion).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dor_assessments (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.apps(id) on delete set null,
  project_name text not null check (length(project_name) > 0 and length(project_name) < 200),
  designer_id uuid references public.profiles(id) on delete set null,
  designer_name text not null check (length(designer_name) > 0 and length(designer_name) < 120),
  track text not null check (track in ('ai', 'figma')),
  -- { [criterionId]: 0 | 0.5 | 1 } — the raw ticks the score is derived from.
  scores jsonb not null default '{}'::jsonb,
  -- Normalized 0–10, server-computed. Never trust the client's number.
  score real not null check (score >= 0 and score <= 10),
  verdict text not null check (verdict in ('cleared', 'almost', 'not_ready')),
  -- Estimated work in HOURS. Stays null until the score clears the ETA unlock
  -- threshold (server-enforced — see lib/dor/criteria.ts).
  eta_hours real check (eta_hours is null or eta_hours >= 0),
  eta_date timestamptz,
  -- Designer's free-text final thoughts on the handoff.
  notes text,
  -- Optional per-section notes: { [criterionId]: note }. Lets the designer
  -- flag/ask the PM about a specific section (PRD, WBS, …).
  section_notes jsonb not null default '{}'::jsonb,
  -- Unguessable token for the public read-only share page (/shared/dor/<token>).
  share_token text,
  -- true = anonymous submission from the public /dor calculator (kept OUT of the
  -- team history). false = internal team assessment by an agency member.
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
-- ETA is tracked in hours. Earlier builds used eta_days; migrate the column
-- across (feature is new, so there's no meaningful data to preserve).
alter table public.dor_assessments add column if not exists eta_hours real;
alter table public.dor_assessments drop column if exists eta_days;
-- Notes + public share token (added after the table shipped).
alter table public.dor_assessments add column if not exists notes text;
alter table public.dor_assessments add column if not exists section_notes jsonb not null default '{}'::jsonb;
alter table public.dor_assessments add column if not exists share_token text;
alter table public.dor_assessments add column if not exists is_public boolean not null default false;
create unique index if not exists dor_assessments_share_token_key on public.dor_assessments(share_token);
create index if not exists dor_assessments_created_idx on public.dor_assessments(created_at desc);
create index if not exists dor_assessments_app_idx on public.dor_assessments(app_id);

-- Agency-only: the whole tool is an internal team activity. Customers never
-- see readiness checks. "Team sees everything" = any agency member reads all
-- rows; the same gate covers insert/update.
alter table public.dor_assessments enable row level security;
drop policy if exists dor_assessments_agency_all on public.dor_assessments;
create policy dor_assessments_agency_all on public.dor_assessments for all
  using (public.is_agency()) with check (public.is_agency());
