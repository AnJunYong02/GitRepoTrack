# [구현 계획] REpository 하이퍼링크, README 리스트 키워드 인식 확장, 제출 여부 판정 기준 변경

- **작성일**: 2026-10-30
- **상태**: 구현 및 검증 완료

## 1. 목표 및 요구사항

1. **REpository 칼럼 하이퍼링크 연결**:
   - 관리자 과제 상세 페이지의 학생 목록 표에서 `REpository` 컬럼의 저장소 이름을 클릭 시, GitHub 저장소(`https://github.com/${sr.full_name}`)가 새 창(`target="_blank" rel="noopener noreferrer"`)으로 열리도록 외부 링크 적용.
2. **README 필수 키워드 검사 문법 확장 (`-, 1. 2.` 등 지원)**:
   - 검사 대상: 각 학생 저장소의 루트 `README.md`
   - 기존의 `#`, `##`, `###` 마크다운 헤딩뿐 아니라, 학생들이 자주 작성하는 불릿 리스트(`-`, `*`, `+`) 및 번호 리스트(`1.`, `2.`, `1)`, `2)`) 뒤에 작성된 키워드도 대제목 키워드로 정상 인식하도록 파서 개선.
3. **"제출 여부" 판정 기준 변경**:
   - 세부 조건 만족 여부가 아닌, **"코드가 push 되었는가 (커밋 존재 여부: `commitCount > 0`)"**만을 기준으로 `제출` / `미제출` 표시.
   - 통계 바의 제출 완료 인원수 집계도 `commitCount > 0` 기준으로 통일.

---

## 2. 작업 체크리스트

- [x] **Step 1**: `src/lib/analysis/readme.ts` - `extractHeadingLines` 정규식 확장 (불릿/번호 리스트 지원)
- [x] **Step 2**: `src/lib/analysis/readme.test.ts` - 리스트 문법 키워드 매칭 단위 테스트 추가 및 검증
- [x] **Step 3**: `src/app/admin/assignments/[id]/page.tsx` - `REpository` 하이퍼링크 적용 및 `제출 여부` push 기준 판정 로직 변경
- [x] **Step 4**: 회귀 테스트 (`npm run test`) 및 프로덕션 빌드 (`npm run build`) 확인
- [x] **Step 5**: 최종 완료 상태 갱신 및 사용자 보고

---

## 3. 수정 대상 파일

- `src/lib/analysis/readme.ts`
- `src/lib/analysis/readme.test.ts`
- `src/app/admin/assignments/[id]/page.tsx`
