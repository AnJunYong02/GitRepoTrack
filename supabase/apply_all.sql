-- ==========================================
-- GitRepoTrack All-in-One Supabase Setup Script
-- ==========================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Schema Creation
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_id bigint unique not null,
  github_login text not null,
  role text not null check (role in ('student', 'staff')) default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.criteria_versions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  version int not null,
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (assignment_id, version)
);

alter table public.assignments
  drop constraint if exists fk_assignments_criteria_version;
alter table public.assignments
  add constraint fk_assignments_criteria_version
  foreign key (current_criteria_version_id)
  references public.criteria_versions(id)
  on delete set null;

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

-- 3. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.criteria_versions enable row level security;
alter table public.roster enable row level security;
alter table public.student_repos enable row level security;
alter table public.push_events enable row level security;
alter table public.snapshots enable row level security;
alter table public.evaluations enable row level security;
alter table public.commits enable row level security;
alter table public.repo_status enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'staff'
  );
$$;

-- Drop existing policies if any
drop policy if exists "Users can view own profile or staff can view all" on public.profiles;
drop policy if exists "Users can update own avatar and login only" on public.profiles;
drop policy if exists "Authenticated users can view assignments" on public.assignments;
drop policy if exists "Staff can manage assignments" on public.assignments;
drop policy if exists "Authenticated users can view criteria" on public.criteria_versions;
drop policy if exists "Staff can manage criteria" on public.criteria_versions;
drop policy if exists "Staff can view and manage roster" on public.roster;
drop policy if exists "Students can view own repos, staff can view all" on public.student_repos;
drop policy if exists "Staff can manage student repos" on public.student_repos;
drop policy if exists "Staff can view push events" on public.push_events;
drop policy if exists "Students can view own repo snapshots, staff can view all" on public.snapshots;
drop policy if exists "Students can view own evaluations, staff can view all" on public.evaluations;
drop policy if exists "Students can view own commits, staff can view all" on public.commits;
drop policy if exists "Students can view own repo status, staff can view all" on public.repo_status;

create policy "Users can view own profile or staff can view all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "Users can update own avatar and login only"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "Authenticated users can view assignments"
  on public.assignments for select to authenticated using (true);

create policy "Staff can manage assignments"
  on public.assignments for all to authenticated using (public.is_staff());

create policy "Authenticated users can view criteria"
  on public.criteria_versions for select to authenticated using (true);

create policy "Staff can manage criteria"
  on public.criteria_versions for all to authenticated using (public.is_staff());

create policy "Staff can view and manage roster"
  on public.roster for all to authenticated using (public.is_staff());

create policy "Students can view own repos, staff can view all"
  on public.student_repos for select to authenticated
  using (profile_id = auth.uid() or public.is_staff());

create policy "Staff can manage student repos"
  on public.student_repos for all to authenticated using (public.is_staff());

create policy "Staff can view push events"
  on public.push_events for select to authenticated using (public.is_staff());

create policy "Students can view own repo snapshots, staff can view all"
  on public.snapshots for select to authenticated
  using (
    exists (
      select 1 from public.student_repos sr
      where sr.id = snapshots.student_repo_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

create policy "Students can view own evaluations, staff can view all"
  on public.evaluations for select to authenticated
  using (
    exists (
      select 1 from public.snapshots s
      join public.student_repos sr on sr.id = s.student_repo_id
      where s.id = evaluations.snapshot_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

create policy "Students can view own commits, staff can view all"
  on public.commits for select to authenticated
  using (
    exists (
      select 1 from public.student_repos sr
      where sr.id = commits.student_repo_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

create policy "Students can view own repo status, staff can view all"
  on public.repo_status for select to authenticated
  using (
    exists (
      select 1 from public.student_repos sr
      where sr.id = repo_status.student_repo_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

-- 4. Leaderboard RPC
create or replace function public.get_leaderboard(target_assignment_id uuid)
returns table (
  rank bigint,
  github_login text,
  first_satisfied_at timestamptz,
  is_submitted boolean
)
language plpgsql
security definer
stable
as $$
declare
  v_ranking_mode text;
  v_ranking_started_at timestamptz;
begin
  select ranking_mode, ranking_started_at
  into v_ranking_mode, v_ranking_started_at
  from public.assignments
  where id = target_assignment_id;

  if not found then
    return;
  end if;

  if v_ranking_mode = 'live' then
    return query
    select
      case
        when rs.first_satisfied_at is not null
         and (v_ranking_started_at is null or rs.first_satisfied_at >= v_ranking_started_at)
        then row_number() over (order by rs.first_satisfied_at asc)
        else null::bigint
      end as rank,
      p.github_login,
      case
        when v_ranking_started_at is null or rs.first_satisfied_at >= v_ranking_started_at
        then rs.first_satisfied_at
        else null::timestamptz
      end as first_satisfied_at,
      coalesce(ev.submitted, false) as is_submitted
    from public.student_repos sr
    join public.profiles p on p.github_id = sr.github_id
    left join public.repo_status rs on rs.student_repo_id = sr.id
    left join public.evaluations ev on ev.snapshot_id = rs.latest_snapshot_id
    where sr.assignment_id = target_assignment_id
    order by
      case when rs.first_satisfied_at is not null and (v_ranking_started_at is null or rs.first_satisfied_at >= v_ranking_started_at) then 0 else 1 end,
      rs.first_satisfied_at asc nulls last,
      p.github_login asc;
  else
    return query
    select
      null::bigint as rank,
      p.github_login,
      null::timestamptz as first_satisfied_at,
      coalesce(ev.submitted, false) as is_submitted
    from public.student_repos sr
    join public.profiles p on p.github_id = sr.github_id
    left join public.repo_status rs on rs.student_repo_id = sr.id
    left join public.evaluations ev on ev.snapshot_id = rs.latest_snapshot_id
    where sr.assignment_id = target_assignment_id
    order by p.github_login asc;
  end if;
end;
$$;

-- 5. Test Seed Data (Sample Assignment with 5 Weekly Keywords)
do $$
declare
  v_assignment_id uuid;
  v_criteria_id uuid;
begin
  -- Insert sample assignment if none exists
  if not exists (select 1 from public.assignments where title = '웹서비스 개발 1차 과제 (주간 리포트)') then
    insert into public.assignments (
      title,
      description,
      org_name,
      branch,
      deadline_at,
      ranking_mode,
      ranking_started_at
    ) values (
      '웹서비스 개발 1차 과제 (주간 리포트)',
      'README 5대 대제목 필수 키워드 작성 및 소스코드 제출 실습',
      '2026-2-WebService',
      'main',
      now() + interval '7 days',
      'live',
      now()
    ) returning id into v_assignment_id;

    insert into public.criteria_versions (
      assignment_id,
      version,
      rules
    ) values (
      v_assignment_id,
      1,
      '{
        "branch": "main",
        "requiredFiles": [
          { "type": "glob_exists", "pattern": "src/**/*", "label": "src/ 아래 소스 파일 존재" }
        ],
        "readme": {
          "required": true,
          "headerKeywords": [
            "Key Learning",
            "Problem & Solution",
            "Code Review",
            "AI Usage",
            "Reflection"
          ]
        }
      }'::jsonb
    ) returning id into v_criteria_id;

    update public.assignments
    set current_criteria_version_id = v_criteria_id
    where id = v_assignment_id;
  end if;
end $$;
