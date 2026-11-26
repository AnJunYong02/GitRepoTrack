-- 0005_org_students.sql: Organization별 학생 명단 (관리자 "학생 관리" 페이지에서 CSV 업로드)
--
-- 기존 secrets/roster.csv · ROSTER_CSV_BASE64 시크릿 명단을 대체한다.
-- 개인정보이므로 RLS를 켜고 정책을 두지 않는다 → anon/authenticated 세션은 읽기·쓰기 불가,
-- 서버의 service role(supabaseAdmin)이 Owner 가드 확인 후에만 접근한다.

create table if not exists public.org_students (
  org_name text not null,
  student_no text not null,
  name text not null default '',
  github_login text,
  emails text[] not null default '{}',
  uploaded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_name, student_no)
);

alter table public.org_students enable row level security;

-- 명단 전체 교체 (delete + insert를 한 트랜잭션으로 처리해 중간 실패 시 빈 명단이 남지 않게 함)
-- p_rows: [{ "student_no": "...", "name": "...", "github_login": "..." | null, "emails": ["..."] }]
create or replace function public.replace_org_students(p_org text, p_rows jsonb, p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.org_students where org_name = p_org;

  insert into public.org_students (org_name, student_no, name, github_login, emails, uploaded_by, updated_at)
  select
    p_org,
    r.student_no,
    coalesce(r.name, ''),
    nullif(r.github_login, ''),
    coalesce(r.emails, '{}'),
    p_user,
    now()
  from jsonb_to_recordset(p_rows) as r(student_no text, name text, github_login text, emails text[]);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 서버(service role)만 호출 가능
revoke execute on function public.replace_org_students(text, jsonb, uuid) from public, anon, authenticated;
