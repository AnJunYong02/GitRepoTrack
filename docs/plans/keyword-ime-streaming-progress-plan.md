# [구현 계획] 한글 입력 중복 방지, 일괄 분석 실시간 진행률 스트리밍, README 기본 키워드 빈 목록화

- **작성일**: 2026-10-30
- **상태**: 구현 및 검증 완료

## 1. 목표 및 요구사항

1. **한글 끝 글자 중복 입력 버그 방지**:
   - `CriteriaForm`에서 "실행 방법" 입력 후 Enter 시 한글 IME 조합(`isComposing`) 간섭으로 "법"이 추가 등록되는 문제 해결.
2. **일괄 분석 진행 상황 실시간 텍스트 표시**:
   - `batch-analyze` API를 `ReadableStream` (NDJSON) 스트리밍으로 전환하고, `BatchAnalyzeButton`에서 `4/33개 분석 완료...`와 같이 실시간 진행률을 텍스트로 표시.
3. **README 키워드 기본값 빈 목록화 및 템플릿 버튼 제거**:
   - `CriteriaForm` 및 과제 생성 로직에서 5대 기본 키워드를 제거하여 완전한 빈 배열(`[]`)로 시작하게 하고, 불러오기 버튼 제거.

---

## 2. 작업 체크리스트

- [x] **Step 1**: `src/components/admin/criteria-form.tsx` - 한글 IME `isComposing` 방어, 기본값 `[]` 설정, 불러오기 버튼 제거
- [x] **Step 2**: `src/app/api/admin/assignments/route.ts` & `src/app/api/admin/org-repos/import/route.ts` - 과제 생성 시 기본 키워드 `[]`로 변경
- [x] **Step 3**: `src/app/api/admin/assignments/[id]/batch-analyze/route.ts` - `ReadableStream` NDJSON 실시간 진행률 스트리밍 구현
- [x] **Step 4**: `src/components/admin/batch-analyze-button.tsx` - 스트림 리더 수신 및 `4/33개 분석 완료...` 실시간 텍스트 표시 구현
- [x] **Step 5**: 단위 테스트 (`npm run test`) 및 프로덕션 빌드 (`npm run build`) 확인
- [x] **Step 6**: 최종 완료 상태 갱신 및 사용자 보고

---

## 3. 수정 대상 파일

- `src/components/admin/criteria-form.tsx`
- `src/app/api/admin/assignments/route.ts`
- `src/app/api/admin/org-repos/import/route.ts`
- `src/app/api/admin/assignments/[id]/batch-analyze/route.ts`
- `src/components/admin/batch-analyze-button.tsx`
