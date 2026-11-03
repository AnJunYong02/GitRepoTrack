# [구현 계획] 콤마(,) 구분 키워드 일괄 등록, 저장 버튼 위치 조정, README 통과 개수(n/m개) 표시

- **작성일**: 2026-10-30
- **상태**: 구현 및 검증 완료

## 1. 목표 및 요구사항

1. **콤마(`,`) 구분 다중 키워드 일괄 등록**:
   - `CriteriaForm`에서 "프로젝트 구조, 실행방법" 입력 후 Enter 또는 추가 버튼 클릭 시 각각 분리되어 개별 태그로 등록되도록 개선.
2. **"새 버전으로 저장" 버튼 위치 이동**:
   - 상단 헤더에서 키워드 입력창 및 `+ 추가` 버튼 바로 오른쪽으로 재배치.
3. **README 충족 여부 컬럼 n/m개 통과 표시**:
   - 학생 현황표에서 `통과` / `키워드 누락` 대신 `3/3개 통과`, `1/3개 통과` 등의 형식으로 통과 개수 표시.

---

## 2. 작업 체크리스트

- [x] **Step 1**: `src/components/admin/criteria-form.tsx` - 콤마 분리 등록 구현 및 "새 버전으로 저장" 버튼 이동
- [x] **Step 2**: `src/app/admin/assignments/[id]/page.tsx` - README 충족 여부 컬럼 `n/m개 통과` 형식 반영
- [x] **Step 3**: 단위 테스트 (`npm run test`) 및 프로덕션 빌드 (`npm run build`) 확인
- [x] **Step 4**: 최종 완료 상태 갱신 및 사용자 보고

---

## 3. 수정 대상 파일

- `src/components/admin/criteria-form.tsx`
- `src/app/admin/assignments/[id]/page.tsx`
