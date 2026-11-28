-- Private creation manifests keep student data out of publicly readable criteria.
create table public.assignment_creation_plans (
  assignment_id uuid primary key references public.assignments(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  org_name text not null,
  settings jsonb not null,
  students jsonb not null check (jsonb_typeof(students) = 'array'),
  files jsonb not null check (jsonb_typeof(files) = 'array'),
  created_at timestamptz not null default now()
);
alter table public.assignment_creation_plans enable row level security;
revoke all on public.assignment_creation_plans from public, anon, authenticated;
grant select, insert, update, delete on public.assignment_creation_plans to service_role;
grant select, insert, update, delete on public.org_students to service_role;

-- A single transaction reserves the assignment, criteria and immutable creation plan.
-- All caller authorization and payload validation is performed in the server route.
create function public.create_assignment_plan(
  p_id uuid, p_org text, p_user uuid, p_settings jsonb, p_students jsonb, p_files jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_assignment public.assignments;
  v_plan public.assignment_creation_plans;
  v_version uuid;
begin
  insert into public.assignments (id, title, org_name, repo_prefix, branch, deadline_at, created_by, description, ranking_started_at)
  values (p_id, p_settings->>'title', p_org,
    coalesce(p_settings->>'repoConvention', p_org || '-' || (p_settings->>'repoBase') || '-' || (p_settings->>'classCode')),
    'main', (p_settings->>'deadlineAt')::timestamptz, p_user, 'RepoTrack assignment creation v1', now())
  on conflict (id) do nothing;

  select * into strict v_assignment from public.assignments where id = p_id for update;
  if v_assignment.created_by is distinct from p_user or lower(v_assignment.org_name) <> lower(p_org) then
    raise exception 'assignment creation conflict' using errcode = '23505';
  end if;
  select * into v_plan from public.assignment_creation_plans where assignment_id = p_id;
  if found then
    if v_plan.settings <> p_settings or v_plan.students <> p_students or v_plan.files <> p_files then
      raise exception 'assignment creation conflict' using errcode = '23505';
    end if;
    return p_id;
  end if;
  if v_assignment.current_criteria_version_id is not null then
    raise exception 'assignment creation conflict' using errcode = '23505';
  end if;

  insert into public.criteria_versions(assignment_id, version, rules, created_by)
  values (p_id, 1, jsonb_build_object(
    'branch', 'main', 'requiredFiles', '[]'::jsonb,
    'minCommits', p_settings->'minCommits',
    'readmeKeywords', p_settings->'keywords',
    'readme', jsonb_build_object('required', p_settings->'readmeRequired', 'headerKeywords', p_settings->'keywords')
  ), p_user) returning id into v_version;
  update public.assignments set current_criteria_version_id = v_version where id = p_id;
  insert into public.assignment_creation_plans(assignment_id, created_by, org_name, settings, students, files)
  values (p_id, p_user, p_org, p_settings, p_students, p_files);
  return p_id;
end;
$$;
revoke all on function public.create_assignment_plan(uuid,text,uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_assignment_plan(uuid,text,uuid,jsonb,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
