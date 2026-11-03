# 학생 학번(22300XXX) 기반 Organization 과제 Repo 매칭 및 대시보드 연동 계획

## 1. 목표
- 관리자가 아닌 학생 계정으로 로그인했을 때, 학생의 학번(예: `22300743` 등 `22300XXX` 형식)을 확인하여 Organization(`2026-2-WebService`) 내 해당 학번과 일치하는 모든 저장소(`assign08_midterm-c01-22300743`, `assign07-c01-22300743`, `assign06-c01-22300743`, `assign05-c01-22300743` 등)를 학생 대시보드(`/dashboard`)로 가져와 최신순으로 표시한다.

---

## 2. 현재 구조 분석
1. **DB 매핑 (`student_repos`)**:
   - 관리자가 과제를 등록할 때 `student_no`에 8자리 학번이 저장되지만, 아직 로그인하지 않은 학생의 경우 `profile_id`가 `null`이고 `github_id`가 학번 숫자로 임시 설정되어 있다.
2. **학생 대시보드 (`src/app/dashboard/page.tsx`)**:
   - 현재 `profile_id` 또는 `github_id`로만 조회하여 학번 기반 매칭이 이루어지지 않는다.
3. **권한 검사 (`src/lib/auth/guards.ts`)**:
   - `requireStudentRepo`에서 `student_no` 기반 소유권 확인 및 `profile_id` 자동 연결이 필요하다.

---

## 3. 수정 및 생성 대상 파일
- [x] `src/lib/student/sync-student-repos.ts` (신규: 학번 자동 추론 및 Organization 내 학번 일치 Repo 동기화 유틸리티)
- [x] `src/app/api/student/student-no/route.ts` (신규: 학생 학번 등록/변경 및 Organization Repo 즉시 동기화 API)
- [x] `src/components/student/student-no-banner.tsx` (신규: 학생 대시보드 학번 연동/변경 UI 컴포넌트)
- [x] `src/lib/auth/guards.ts` (수정: `requireStudentRepo`에 학번 기반 소유권 확인 및 자동 `profile_id` 연결 추가)
- [x] `src/app/api/admin/org-repos/import/route.ts` (수정: 과제 일괄 등록 시 기존 연동 학번의 `profile_id` 보존 및 자동 연결)
- [x] `src/app/dashboard/page.tsx` (수정: 학생 학번 자동 확인, Organization Repo 동기화, 최신 과제순 정렬 및 GitHub 외부 링크 표시)

---

## 4. 구현 순서 체크리스트
- [x] 1단계: `src/lib/student/sync-student-repos.ts` 구현 (`resolveStudentNo`, `syncReposForStudent`)
- [x] 2단계: `src/app/api/student/student-no/route.ts` API 엔드포인트 구현
- [x] 3단계: `src/components/student/student-no-banner.tsx` 클라이언트 컴포넌트 구현
- [x] 4단계: `src/lib/auth/guards.ts` 및 `src/app/api/admin/org-repos/import/route.ts` 수정
- [x] 5단계: `src/app/dashboard/page.tsx` 업데이트 (학번 배너, 자동 매칭, 최신순 정렬, GitHub 링크)
- [x] 6단계: 단위 테스트(`npm run test`) 및 프로덕션 빌드(`npm run build`) 검증

---

## 5. 테스트 방법 및 예상 위험 요소
- **테스트 방법**: `npm run test` 및 `npm run build`를 통해 타입·컴파일 검증 및 파서/평가 로직 테스트 수행.
- **예상 위험 요소**:
  - 별도 DB 마이그레이션 없이 즉시 동작하도록 Supabase Auth `user_metadata.student_no`와 `student_repos.student_no`를 함께 사용한다.
  - `student_repos`의 `unique(assignment_id, github_id)` 제약 조건과 충돌하지 않도록 `profile_id`를 업데이트하고 `student_no` 기준으로 매칭한다.
