# [구현 계획] 기준 커밋 수(minCommits) 설정, 현황표 (실제/기준) 표시, 순위표 1·2·3등 상단 포디움 배치

- **작성일**: 2026-10-30
- **상태**: 구현 및 검증 완료

## 1. 목표 및 요구사항

1. **기준 커밋 수 입력 칸 추가 및 현황표 표시 형식 개선**:
   - `CriteriaForm`에서 "README 필수 대제목 키워드 목록" 아래에 기준 commit 수를 입력할 수 있는 칸 추가 (`rules.minCommits`).
   - 학생 현황표에서 `commit 갯수` 컬럼을 `(실제 학생 커밋수 / 커밋 기준 수)` 형식으로 표시 (예: `18 / 5개` - 초록색, `3 / 5개` - 주황색).
2. **순위표(Leaderboard) 3대 조건 완벽 충족자 대상 1·2·3등 상단 포디움 배치**:
   - 순위 자격: 코드 push 완료(`commitCount > 0`) + 기준 커밋수 충족(`commitCount >= minCommits`) + README 필수 키워드 전체 충족.
   - 최초 완료 시각 순으로 1위(🥇), 2위(🥈), 3위(🥉) 상단 포디움 카드 및 테이블 최상단 배치.

---

## 2. 작업 체크리스트

- [x] **Step 1**: `src/components/admin/criteria-form.tsx` - 기준 커밋 수(minCommits) 입력 필드 추가 및 저장 연동
- [x] **Step 2**: `src/lib/analysis/evaluate.ts` & `src/lib/analysis/run-analysis.ts` - minCommits 평가 반영 및 `first_satisfied_at` 기록 보강
- [x] **Step 3**: `src/app/admin/assignments/[id]/page.tsx` - 현황표 `commit 갯수` 컬럼을 `실제 / 기준` 형식으로 변경
- [x] **Step 4**: `src/app/assignments/[id]/leaderboard/page.tsx` - 3대 조건 충족자 1·2·3등 상단 포디움 및 랭킹 정렬 구현
- [x] **Step 5**: 회귀 테스트 (`npm run test`) 및 프로덕션 빌드 (`npm run build`) 확인
- [x] **Step 6**: 최종 완료 상태 갱신 및 사용자 보고

---

## 3. 수정 대상 파일

- `src/components/admin/criteria-form.tsx`
- `src/lib/analysis/evaluate.ts`
- `src/lib/analysis/run-analysis.ts`
- `src/app/admin/assignments/[id]/page.tsx`
- `src/app/assignments/[id]/leaderboard/page.tsx`
