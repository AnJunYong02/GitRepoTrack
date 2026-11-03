"use client";

import { useState } from "react";
import { Plus, X, Save, CheckCircle } from "lucide-react";

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

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const payload = {
        rules: {
          branch,
          minCommits: Number(minCommits) || 0,
          requiredFiles: [
            {
              type: "glob_exists",
              pattern: "src/**/*",
              label: "src/ 아래 소스 파일 존재",
            },
          ],
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

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <h2 className="text-lg font-bold">과제 제출 기준 및 README 검사 설정</h2>
        <p className="text-xs text-slate-500">
          과제별로 README에 필수 포함되어야 할 대제목 키워드와 기준 브랜치를 설정합니다.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Branch Setting */}
      <div className="space-y-2">
        <label className="text-sm font-medium">분석 기준 브랜치</label>
        <input
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          placeholder="main"
        />
      </div>

      {/* README Header Keywords Customizer */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">README 필수 대제목 키워드 목록</label>
          <p className="text-xs text-slate-500">
            README 내에 해당 대제목(#, ##, ### 등)이 포함되어 있지 않으면 미충족으로 판정됩니다.
          </p>
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-2 min-h-12 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          {keywords.length === 0 ? (
            <span className="text-xs text-slate-400">지정된 키워드가 없습니다. 아래에서 키워드를 직접 추가해주세요.</span>
          ) : (
            keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/60 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-200"
              >
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Add Keyword Input & Actions */}
        <div className="flex flex-wrap items-center gap-2">
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
            placeholder="새 키워드 입력 (예: 프로젝트 구조, 실행방법)"
            className="flex-1 min-w-[240px] max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 dark:bg-slate-200 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-700 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>추가</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shrink-0 transition shadow-sm"
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>저장 완료!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? "저장 중..." : "새 버전으로 저장"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Minimum Commits Threshold */}
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div>
          <label className="text-sm font-medium">제출 인정 기준 최소 커밋(Commit) 수</label>
          <p className="text-xs text-slate-500">
            학생이 이 횟수 이상 커밋을 push해야 기준을 충족한 것으로 판정합니다. (0 또는 빈칸 입력 시 커밋 수 제한 없음)
          </p>
        </div>
        <div className="flex items-center gap-2 max-w-xs">
          <input
            type="number"
            min={0}
            value={minCommits === 0 ? "" : minCommits}
            onChange={(e) => setMinCommits(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
            placeholder="예: 5"
            className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-medium"
          />
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">개 이상</span>
        </div>
      </div>
    </div>
  );
}
