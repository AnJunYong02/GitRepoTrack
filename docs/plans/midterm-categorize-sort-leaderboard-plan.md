# [구현 계획] assign08_midterm 자동 분류, 과제 최신순 정렬, 관리자 순위표 연동 및 개선

- **작성일**: 2026-10-30
- **상태**: 구현 및 검증 완료

## 1. 목표 및 요구사항

1. **`assign08_midterm` 저장소 자동 분류**:
   - `assign08_midterm-c01-22100063` 등 29개 중간고사 저장소를 `과제 8차 중간고사 (assign08_midterm)` 카테고리로 자동 분류.
2. **과제 목록 최신순(내림차순) 정렬**:
   - Organization 저장소 분류 목록을 최신순(8차 -> 7차 -> ... -> 1차 -> 기타)으로 정렬하여 최신 과제가 상단에 노출되도록 개선.
3. **순위표(Leaderboard) 접근 위치 제공 및 표시 개선**:
   - 관리자 과제 상세 페이지 및 관리자 메인 화면에 `[🏆 순위표]` 바로가기 버튼 추가.
   - 미로그인 학생도 누락 없이 표시되도록 순위표 조회 로직 개선.

---

## 2. 작업 체크리스트

- [x] **Step 1**: `src/lib/github/repo-parser.ts` - `assign08_midterm` 패턴 지원 및 라벨 생성
- [x] **Step 2**: `src/lib/github/repo-parser.test.ts` - 중간고사 파싱 단위 테스트 추가 및 검증 (16/16 통과)
- [x] **Step 3**: `src/app/api/admin/org-repos/route.ts` - 카테고리 최신순(내림차순) 정렬 적용
- [x] **Step 4**: `src/app/admin/assignments/[id]/page.tsx` & `src/app/admin/page.tsx` - 관리자 `[🏆 순위표]` 바로가기 버튼 추가
- [x] **Step 5**: `src/app/assignments/[id]/leaderboard/page.tsx` - 순위표 학생 데이터 조회 보강 및 뒤로가기 링크 추가
- [x] **Step 6**: 회귀 테스트 (`npm run test`) 및 프로덕션 빌드 (`npm run build`) 확인
- [x] **Step 7**: 최종 완료 상태 갱신 및 사용자 보고

---

## 3. 수정 대상 파일

- `src/lib/github/repo-parser.ts`
- `src/lib/github/repo-parser.test.ts`
- `src/app/api/admin/org-repos/route.ts`
- `src/app/admin/assignments/[id]/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/assignments/[id]/leaderboard/page.tsx`
