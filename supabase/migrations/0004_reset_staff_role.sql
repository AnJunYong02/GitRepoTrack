-- 0004_reset_staff_role.sql: 계정 전체 staff 권한 제거
--
-- 권한은 이제 Organization별 Owner 여부로만 판단한다(앱의 checkIsUserOwnerOfOrg).
-- 예전에 "org 하나라도 Owner면 staff"로 저장된 값이 남아 있으면,
-- RLS의 is_staff()가 true가 되어 해당 사용자가 자기 세션으로 모든 org 데이터를 직접 읽을 수 있다.
-- 그래서 기존 staff 값을 모두 student로 되돌린다. (컬럼과 제약은 호환성을 위해 유지)
-- 로그인 콜백도 이제 role을 항상 'student'로 저장하므로, 실행 후 staff 값은 다시 생기지 않는다.

update public.profiles
set role = 'student',
    updated_at = now()
where role = 'staff';
