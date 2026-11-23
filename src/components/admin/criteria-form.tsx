"use client";

import { useState } from "react";
import { Plus, X, CheckCircle } from "lucide-react";

interface CriteriaFormProps {
  assignmentId: string;
  initialRules?: {
    branch?: string;
    minCommits?: number;
    requiredFiles?: { type: "glob_exists" | "path_exists"; pattern?: string; path?: string; label: string }[];
    readme?: {
      required?: boolean;
      headerKeywords?: string[];
    };
  };
  onSaved?: () => void;
}

export function CriteriaForm({ assignmentId, initialRules, onSaved }: CriteriaFormProps) {
  const [branch, setBranch] = useState(initialRules?.branch || "main");
  const [minCommits, setMinCommits] = useState<number>(initialRules?.minCommits || 0);
  const [readmeRequired, setReadmeRequired] = useState(initialRules?.readme?.required ?? true);
  const [keywords, setKeywords] = useState<string[]>(
    initialRules?.readme?.headerKeywords || []
  );
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAddKeyword = () => {
    if (!newKeywordInput.trim()) return;

    // Split by comma: e.g. "프로젝트 구조, 실행방법"
    const rawItems = newKeywordInput.split(",");
    const newKeywordsToAdd: string[] = [];

    for (const item of rawItems) {
      const trimmed = item.trim();
      if (
        trimmed &&
        !keywords.includes(trimmed) &&
        !newKeywordsToAdd.includes(trimmed)
      ) {
        newKeywordsToAdd.push(trimmed);
      }
    }

    if (newKeywordsToAdd.length > 0) {
      setKeywords([...keywords, ...newKeywordsToAdd]);
      setNewKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== keywordToRemove));
  };

  // 키워드 전체 삭제 (저장 버튼을 눌러야 서버에 반영됨)
  const handleClearKeywords = () => {
    if (keywords.length === 0) return;
    if (!window.confirm(`키워드 ${keywords.length}개를 모두 삭제할까요?`)) return;
    setKeywords([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const payload = {
        rules: {
          branch,
          minCommits: Number(minCommits) || 0,
          requiredFiles: [],
          readme: {
            required: readmeRequired,
            headerKeywords: keywords,
          },
          readmeKeywords: keywords,
        },
      };

      const res = await fetch(`/api/admin/assignments/${assignmentId}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "기준 저장에 실패했습니다.");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const INPUT =
    "w-full rounded-xl bg-chip px-4 py-3 text-[14px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <section aria-label="제출 기준 설정" className="space-y-7">
      <h2 className="text-[22px] font-bold tracking-tight text-fg">제출 기준 설정</h2>

      {errorMsg && (
        <p role="alert" className="text-[13px] text-danger">
          {errorMsg}
        </p>
      )}

      {/* 분석 기준 브랜치 */}
      <div className="space-y-3">
        <label htmlFor="criteria-branch" className="block text-[15px] font-bold text-fg">
          분석 기준 브랜치
        </label>
        <input
          id="criteria-branch"
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className={INPUT}
          placeholder="main"
        />
      </div>

      {/* README 필수 키워드 */}
      <div className="space-y-3 border-t border-line pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[15px] font-bold text-fg">
              README 필수 키워드 <span className="text-[12px] font-normal text-fg-3">{keywords.length}개</span>
            </p>
            <p className="text-[12px] leading-relaxed text-fg-3">
              README 어디에든 키워드가 있으면 충족으로 판정해요. (대소문자·띄어쓰기 무시)
            </p>
          </div>
          {keywords.length > 0 && (
            <button
              type="button"
              onClick={handleClearKeywords}
              className="shrink-0 text-[13px] font-semibold text-danger hover:underline"
            >
              전체 삭제
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <p className="text-[13px] text-fg-3">지정된 키워드가 없어요. 아래에서 추가해 주세요.</p>
          ) : (
            keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-lg bg-chip px-3 py-1.5 text-[13px] font-medium text-fg-2"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  aria-label={`${keyword} 키워드 삭제`}
                  className="text-fg-3 hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newKeywordInput}
            onChange={(e) => setNewKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddKeyword();
              }
            }}
            placeholder="키워드 입력 (예: 프로젝트 구조)"
            aria-label="추가할 README 키워드 (쉼표로 여러 개)"
            className={`${INPUT} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-fg px-4 py-3 text-[14px] font-bold text-canvas hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
      </div>

      {/* 최소 커밋 수 */}
      <div className="space-y-3 border-t border-line pt-7">
        <div className="space-y-1">
          <label htmlFor="criteria-min-commits" className="block text-[15px] font-bold text-fg">
            최소 커밋 수
          </label>
          <p className="text-[12px] leading-relaxed text-fg-3">
            이 횟수 이상 push해야 기준 충족으로 판정해요. (0 또는 빈칸은 제한 없음)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="criteria-min-commits"
            type="number"
            min={0}
            value={minCommits === 0 ? "" : minCommits}
            onChange={(e) =>
              setMinCommits(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))
            }
            placeholder="예: 5"
            className="w-28 rounded-xl bg-chip px-4 py-3 text-center text-[15px] font-bold text-fg focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span className="text-[14px] text-fg-2">개 이상</span>
        </div>
      </div>

      {/* 저장 */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-4 text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {saveSuccess ? (
          <>
            <CheckCircle className="h-4 w-4" />
            저장 완료!
          </>
        ) : isSaving ? (
          "저장 중..."
        ) : (
          "저장"
        )}
      </button>
    </section>
  );
}
