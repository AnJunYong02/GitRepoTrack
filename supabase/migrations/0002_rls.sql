-- Enable RLS on all tables
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

-- Helper function: Check if current user is staff
create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'staff'
  );
$$;

-- 1. Profiles
create policy "Users can view own profile or staff can view all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "Users can update own avatar and login only"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- 2. Assignments
create policy "Authenticated users can view assignments"
  on public.assignments for select
  to authenticated
  using (true);

create policy "Staff can manage assignments"
  on public.assignments for all
  to authenticated
  using (public.is_staff());

-- 3. Criteria Versions
create policy "Authenticated users can view criteria"
  on public.criteria_versions for select
  to authenticated
  using (true);

create policy "Staff can manage criteria"
  on public.criteria_versions for all
  to authenticated
  using (public.is_staff());

-- 4. Roster
create policy "Staff can view and manage roster"
  on public.roster for all
  to authenticated
  using (public.is_staff());

-- 5. Student Repos (Crucial isolation!)
create policy "Students can view own repos, staff can view all"
  on public.student_repos for select
  to authenticated
  using (profile_id = auth.uid() or public.is_staff());

create policy "Staff can manage student repos"
  on public.student_repos for all
  to authenticated
  using (public.is_staff());

-- 6. Push Events
create policy "Staff can view push events"
  on public.push_events for select
  to authenticated
  using (public.is_staff());

-- 7. Snapshots
create policy "Students can view own repo snapshots, staff can view all"
  on public.snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.student_repos sr
      where sr.id = snapshots.student_repo_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

-- 8. Evaluations
create policy "Students can view own evaluations, staff can view all"
  on public.evaluations for select
  to authenticated
  using (
    exists (
      select 1 from public.snapshots s
      join public.student_repos sr on sr.id = s.student_repo_id
      where s.id = evaluations.snapshot_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

-- 9. Commits
create policy "Students can view own commits, staff can view all"
  on public.commits for select
  to authenticated
  using (
    exists (
      select 1 from public.student_repos sr
      where sr.id = commits.student_repo_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );

-- 10. Repo Status
create policy "Students can view own repo status, staff can view all"
  on public.repo_status for select
  to authenticated
  using (
    exists (
      select 1 from public.student_repos sr
      where sr.id = repo_status.student_repo_id
      and (sr.profile_id = auth.uid() or public.is_staff())
    )
  );
