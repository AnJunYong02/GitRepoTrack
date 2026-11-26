"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardCopy, Info } from "lucide-react";
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
    // 아래 예전 방식으로 재시도
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

/** README 필수 키워드 검사: 통과 | 미감지 두 열 (미감지 키워드는 클릭하면 "## 키워드" 복사) */
export function ReadmeChecklist({ details, missingKeywords }: ReadmeChecklistProps) {
  // "all" = 일괄 복사 완료, 그 외 문자열 = 해당 키워드 복사 완료, "error" = 실패
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
  const passedItems = safeDetails.filter((d) => d.found);
  const failedItems = safeDetails.filter((d) => !d.found);
  const total = safeDetails.length;

  return (
    <section aria-label="README 필수 키워드 검사" className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">
          README 필수 키워드 검사
        </h2>
        {total > 0 && (
          <span className="text-[12px] text-fg-3">
            {total}개 중 {passedItems.length}개 통과
            {failedItems.length > 0 && ` · ${failedItems.length}개 부족`}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="border-y border-line py-10 text-center text-[13px] text-fg-3">
          설정된 README 필수 키워드가 없거나 아직 분석 전이에요.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          {/* 통과 */}
          <div>
            <ColumnHeader label="통과" count={passedItems.length} tone="ok" />
            {passedItems.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-fg-3">아직 통과한 키워드가 없어요.</p>
            ) : (
              <ul>
                {passedItems.map((item, idx) => (
                  <li
                    key={`${item.keyword}-${idx}`}
                    className="flex min-h-[64px] items-center justify-between gap-3 border-b border-line py-4 text-[14px] text-fg"
                  >
                    <span className="break-words">{item.keyword}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brand">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      통과
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 미감지 */}
          <div>
            <ColumnHeader label="미감지" count={failedItems.length} tone="bad" />
            {failedItems.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-medium text-brand">모든 필수 키워드를 통과했어요.</p>
            ) : (
              <>
                {/* 미감지가 많아도 왼쪽 열이 길어지지 않게 약 6개 높이에서 스크롤 */}
                <ul tabIndex={0} aria-label="미감지 키워드 목록" className="max-h-[390px] overflow-y-auto pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
                  {failedItems.map((item, idx) => {
                    const key = `kw:${item.keyword}-${idx}`;
                    const isCopied = copied === key;
                    return (
                      <li key={key} className="border-b border-line">
                        <button
                          type="button"
                          title={`클릭하면 "## ${item.keyword}" 양식이 복사됩니다`}
                          onClick={() => handleCopy(key, [item.keyword])}
                          className="group flex min-h-[64px] w-full items-center justify-between gap-3 py-4 text-left text-[14px] text-fg"
                        >
                          <span className="break-words">{item.keyword}</span>
                          {isCopied ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brand">
                              <Check className="h-3.5 w-3.5" />
                              복사됨
                            </span>
                          ) : (
                            <span className="shrink-0 text-[12px] font-semibold text-danger">
                              <span className="group-hover:hidden">미감지</span>
                              <span className="hidden group-hover:inline">## 복사</span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => handleCopy("all", failedItems.map((i) => i.keyword))}
                  className="mt-10 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-danger-soft px-4 py-3 text-[13px] font-semibold text-danger transition hover:brightness-95"
                >
                  {copied === "all" ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      복사 완료! README에 붙여넣으세요
                    </>
                  ) : copied === "error" ? (
                    "복사에 실패했어요. 브라우저 권한을 확인해 주세요"
                  ) : (
                    <>
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      미감지 키워드 마크다운 일괄 복사 ({failedItems.length}개)
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 분석 기준 안내 (토글) */}
      <CriteriaToggle exampleKeyword={failedItems[0]?.keyword ?? missingKeywords?.[0] ?? null} />
    </section>
  );
}

/** "README 키워드 분석 기준" 토글: 누르면 인식 팁과 판정 기준이 펼쳐짐 */
function CriteriaToggle({ exampleKeyword }: { exampleKeyword: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-t border-line pt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 text-left text-[14px] font-semibold text-fg transition hover:text-fg-2"
      >
        <Info className="h-4 w-4 shrink-0 text-chart" />
        <span className="flex-1">README 키워드 분석 기준</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-3 transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 높이를 몰라도 부드럽게 펼치기: grid-rows 0fr → 1fr */}
      <div
        id={panelId}
        role="region"
        aria-label="README 키워드 분석 기준 설명"
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" inert={!open || undefined}>
          <div className="ml-2 mt-4 space-y-3 border-l-2 border-line pl-4 text-[13px] leading-relaxed text-fg-2">
            {exampleKeyword && (
              <p>
                💡 인식이 안 된 키워드가 있을시, README파일에 해당 문구 포함해 작성 → 다시 push하고 → <strong className="font-semibold text-fg">[GitHub 새로고침]</strong> 클릭
              </p>
            )}
            <p>
                💡 README 어디에든 키워드 문구가 포함되어 있으면 충족으로 판정.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColumnHeader({ label, count, tone }: { label: string; count: number; tone: "ok" | "bad" }) {
  const color = tone === "ok" ? "border-brand text-brand" : "border-danger text-danger";
  return (
    <div className={`flex items-center justify-between border-b-2 pb-3 ${color}`}>
      <span className="text-[14px] font-bold">{label}</span>
      <span className="text-[12px] font-semibold">{count}개</span>
    </div>
  );
}
