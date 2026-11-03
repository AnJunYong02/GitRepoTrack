-- 0003_rpc.sql: Secure Leaderboard RPC

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
  -- Get assignment ranking settings
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
        then row_number() over (
          order by rs.first_satisfied_at asc
        )
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
    -- ranking_mode = 'none': No ranking numbers, only completion status
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
