"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, ClipboardCopy, Check } from "lucide-react";
import { buildMarkdownHeadings } from "@/lib/student/time-utils";

interface ReadmeChecklistProps {
  satisfied: boolean;
  missingKeywords: string[];
  details: { keyword: string; found: boolean }[];
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ReadmeChecklist({
  satisfied,
  missingKeywords,
  details,
}: ReadmeChecklistProps) {
  // "all" = 일괄 복사 완료, 그 외 문자열 = 해당 키워드 개별 복사 완료, "error" = 실패
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async (key: string, keywords: string[]) => {
    const ok = await copyToClipboard(buildMarkdownHeadings(keywords));
    setCopied(ok ? key : "error");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(null), 2000);
  };

  const safeDetails = Array.isArray(details) ? details : [];
  const totalCount = safeDetails.length;
  const passedItems = safeDetails.filter((d) => d.found);
  const failedItems = safeDetails.filter((d) => !d.found);
  const passedCount = passedItems.length;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">README 필수 키워드 검사 결과</h3>
        {totalCount > 0 && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              satisfied
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-600/20"
                : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 ring-1 ring-red-600/20"
            }`}
          >
            {satisfied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{passedCount}/{totalCount}개 통과 (전체 충족)</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                <span>
                  {passedCount}/{totalCount}개 통과 ({missingKeywords.length}개 부족)
                </span>
              </>
            )}
          </span>
        )}
      </div>


      {totalCount === 0 ? (
        <div className="rounded-lg border border-slate-100 dark:border-slate-800 p-3 text-xs text-slate-500">
          설정된 README 필수 대제목 키워드가 없거나 아직 분석 전입니다.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Left Column: Passed Items */}
            <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>통과 항목</span>
                </span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                  {passedItems.length}개
                </span>
              </div>

              {passedItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  아직 통과한 키워드가 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {passedItems.map((item, idx) => (
                    <div
                      key={`${item.keyword}-${idx}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-emerald-200 bg-white/90 text-emerald-900 dark:border-emerald-900/50 dark:bg-slate-900/80 dark:text-emerald-200 text-xs shadow-2xs"
                    >
                      <span className="font-medium break-all">{item.keyword}</span>
                      <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>통과</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Failed / Unpassed Items */}
            <div className="rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-red-200/60 dark:border-red-900/40 pb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>불통과 항목 (미감지)</span>
                </span>
                <span className="rounded-full bg-red-100 dark:bg-red-900/60 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:text-red-200">
                  {failedItems.length}개
                </span>
              </div>

              {failedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleCopy("all", failedItems.map((i) => i.keyword))}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                >
                  {copied === "all" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>복사 완료! README에 붙여넣으세요</span>
                    </>
                  ) : copied === "error" ? (
                    <span>복사에 실패했습니다. 브라우저 권한을 확인해주세요</span>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5" />
                      <span>미감지 키워드 마크다운 일괄 복사 ({failedItems.length}개)</span>
                    </>
                  )}
                </button>
              )}

              {failedItems.length === 0 ? (
                <div className="py-6 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  모든 필수 키워드를 통과
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {failedItems.map((item, idx) => {
                    const itemKey = `kw:${item.keyword}-${idx}`;
                    const isCopied = copied === itemKey;
                    return (
                      <button
                        type="button"
                        key={`${item.keyword}-${idx}`}
                        title={`클릭하면 "## ${item.keyword}" 양식이 복사됩니다`}
                        onClick={() => handleCopy(itemKey, [item.keyword])}
                        className="group w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-red-200 bg-white/90 text-left text-red-900 dark:border-red-900/50 dark:bg-slate-900/80 dark:text-red-200 text-xs shadow-2xs hover:border-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 transition cursor-pointer"
                      >
                        <span className="font-medium break-all">{item.keyword}</span>
                        {isCopied ? (
                          <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                            <span>복사됨!</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5 group-hover:hidden" />
                            <ClipboardCopy className="w-3.5 h-3.5 hidden group-hover:inline" />
                            <span className="group-hover:hidden">미감지 (부족)</span>
                            <span className="hidden group-hover:inline">## 복사</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {!satisfied && missingKeywords.length > 0 && (
            <p className="text-[11px] text-slate-500 pt-1">
              💡 인식이 안 된 키워드가 있다면 README 파일에 마크다운 대제목(예:{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">
                ## {missingKeywords[0]}
              </code>
              ) 형식으로 작성한 뒤 다시 push하고 <strong>[GitHub 새로고침]</strong>을 눌러보세요.
            </p>
          )}
        </>
      )}
        {/* Accuracy Notice Box */}
        <div className="flex items-start gap-2 rounded-lg border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="space-y-0.5 leading-relaxed">
                <p className="font-semibold">README 키워드 분석 기준</p>
                <p className="text-[11px] text-blue-700/90 dark:text-blue-300/90">
                    키워드 검사는 마크다운 대제목(<code className="font-mono">#</code>, <code className="font-mono">##</code>) 및 목록 형식을 기준으로 자동 분석되므로,<br/>
                    작성 양식이나 특수문자·띄어쓰기 차이로 인해 실제로 작성하셨더라도 일부 키워드를 감지하지 못하거나 검사 결과가 정확하지 않을 수 있습니다.
                </p>
            </div>
        </div>
    </div>
  );
}
