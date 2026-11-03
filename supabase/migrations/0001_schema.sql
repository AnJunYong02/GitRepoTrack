-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles (User role & GitHub mapping)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_id bigint unique not null,
  github_login text not null,
  role text not null check (role in ('student', 'staff')) default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Assignments
create table if not exists public.assignments (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  org_name text not null,
  repo_prefix text,
  branch text not null default 'main',
  deadline_at timestamptz not null,
  ranking_mode text not null check (ranking_mode in ('live', 'none')) default 'live',
  ranking_started_at timestamptz,
  current_criteria_version_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Criteria Versions (Immutable criteria snapshots)
create table if not exists public.criteria_versions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  version int not null,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (assignment_id, version)
);

-- Foreign key back to criteria_versions
alter table public.assignments
  add constraint fk_assignments_criteria_version
  foreign key (current_criteria_version_id)
  references public.criteria_versions(id)
  on delete set null;

-- 4. Roster (Pre-registered student list)
create table if not exists public.roster (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  github_login text not null,
  github_id bigint,
  student_no text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_no)
);

-- 5. Student Repos (Assignment <-> Student mapping)
create table if not exists public.student_repos (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  github_id bigint not null,
  repo_id bigint not null,
  full_name text not null,
  student_no text,
  student_name text,
  created_at timestamptz not null default now(),
  unique (assignment_id, github_id)
);

create index if not exists idx_student_repos_repo_id on public.student_repos(repo_id);
create index if not exists idx_student_repos_profile on public.student_repos(profile_id);

-- 6. Push Events (Queue & idempotency)
create table if not exists public.push_events (
  id uuid primary key default uuid_generate_v4(),
  delivery_id text unique not null,
  repo_id bigint not null,
  ref text not null,
  after_sha text not null,
  pushed_at timestamptz not null,
  status text not null check (status in ('pending', 'done', 'failed', 'ignored')) default 'pending',
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_events_repo_status on public.push_events(repo_id, status);

-- 7. Snapshots
create table if not exists public.snapshots (
  id uuid primary key default uuid_generate_v4(),
  student_repo_id uuid not null references public.student_repos(id) on delete cascade,
  commit_sha text not null,
  observed_at timestamptz not null default now(),
  source text not null check (source in ('webhook', 'manual', 'cron', 'initial')),
  tree_paths text[] not null default '{}',
  readme_text text,
  commit_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_snapshots_repo on public.snapshots(student_repo_id, observed_at desc);

-- 8. Evaluations
create table if not exists public.evaluations (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  criteria_version_id uuid not null references public.criteria_versions(id) on delete cascade,
  submitted boolean not null default false,
  file_results jsonb not null default '{}'::jsonb,
  readme_results jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  unique (snapshot_id, criteria_version_id)
);

-- 9. Commits (For history & graphs)
create table if not exists public.commits (
  id uuid primary key default uuid_generate_v4(),
  student_repo_id uuid not null references public.student_repos(id) on delete cascade,
  sha text not null,
  committed_at timestamptz not null,
  author_login text,
  message text,
  unique (student_repo_id, sha)
);

create index if not exists idx_commits_repo_time on public.commits(student_repo_id, committed_at asc);

-- 10. Repo Status (Latest aggregated dashboard view)
create table if not exists public.repo_status (
  student_repo_id uuid primary key references public.student_repos(id) on delete cascade,
  latest_snapshot_id uuid references public.snapshots(id) on delete set null,
  fetched_at timestamptz not null default now(),
  stale boolean not null default false,
  last_error text,
  first_satisfied_at timestamptz,
  first_satisfied_criteria_version_id uuid references public.criteria_versions(id) on delete set null,
  manual_refresh_at timestamptz,
  updated_at timestamptz not null default now()
);
