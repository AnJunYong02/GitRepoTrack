# 학생 대시보드 보안 강화(학번 변경 제거), 상세 미충족 사유 표시, README 안내 문구 및 OAuth 화면 개선 계획

## 1. 목표
1. 학생이 다른 학생의 Repo 정보를 불러오지 못하도록 `[학번 변경]` 기능을 제거하고, 서버 API에서도 한 번 등록된 학번 변경 및 타 학생 학번 등록을 원천 차단한다.
2. 학생 대시보드(`/dashboard`)의 각 과제 카드에서 단순 `"미제출(조건 미충족)"` 대신 **커밋 몇 개 부족, README 키워드 몇 개 부족, 지각 여부**를 구체적으로 표시하고, 정규화된 과제 번호 기준 최신순(`assign09` → `assign08_midterm` → ... → `assign02` → `assign01`)으로 정렬한다.
3. 학생 분석 대시보드(`/dashboard/[studentRepoId]`)의 README 키워드 검사 영역에 키워드 자동 감지 및 검사 결과가 마크다운 작성 양식에 따라 정확하지 않을 수 있다는 안내 문구를 추가한다.
4. 로그인 페이지(`/login`)에 GitHub OAuth 승인 화면의 `Authorize AnJunYong02` (`RepoTrack by JunYong An`) 표시 이유를 안내하여 학생들의 혼란을 방지한다.

---

## 2. 수정 대상 파일 체크리스트
- [x] `src/components/student/student-no-banner.tsx` (학번 변경 버튼 제거 및 최초 1회 등록 고정 UI)
- [x] `src/app/api/student/student-no/route.ts` (학번 변경 차단 및 타 학생 학번 도용 403 차단)
- [x] `src/app/dashboard/page.tsx` (구체적 미충족 사유 배지, 커밋/키워드 부족 개수 및 지각 여부 표시, 정규화 최신순 정렬)
- [x] `src/components/student/readme-checklist.tsx` (README 키워드 자동 분석 정확도 안내 문구 및 통과 개수 표시)
- [x] `src/app/login/page.tsx` (GitHub OAuth `Authorize AnJunYong02` 안내 배너 추가)

---

## 3. 구현 순서 체크리스트
- [x] 1단계: `src/components/student/student-no-banner.tsx` 및 `src/app/api/student/student-no/route.ts` 수정 (학번 변경 제거 및 서버 검증 강화)
- [x] 2단계: `src/app/dashboard/page.tsx` 수정 (커밋 부족 수, README 키워드 부족 수, 지각 여부 표시 및 최신순 정렬 보정)
- [x] 3단계: `src/components/student/readme-checklist.tsx` 수정 (README 키워드 분석 한계 안내 문구 추가)
- [x] 4단계: `src/app/login/page.tsx` 수정 (`Authorize AnJunYong02` 안내 문구 추가)
- [x] 5단계: 단위 테스트(`npm run test`) 및 프로덕션 빌드(`npm run build`) 검증
