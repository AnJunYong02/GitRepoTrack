"use client";

import { useState } from "react";
import { Copy, ClipboardPaste } from "lucide-react";
import { parseKeywords } from "@/lib/assignments/creation";

export function KeywordTransfer({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (words: string[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [manualPaste, setManualPaste] = useState(false);
  const [text, setText] = useState("");
  const merge = (value: string) => {
    const words = parseKeywords(value);
    if (words.length === 0) {
      setMessage("붙여넣을 단어가 없습니다.");
      return;
    }
    onChange([...new Set([...keywords, ...words])]);
    setMessage("단어를 붙여넣었습니다. 저장하면 반영됩니다.");
    setManualPaste(false);
    setText("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold text-fg-2 hover:text-brand"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(keywords.join("\n"));
              setMessage("검사 단어를 복사했습니다.");
            } catch {
              setText(keywords.join("\n"));
              setManualPaste(true);
              setMessage("아래 내용을 직접 선택해 복사하세요.");
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" /> 단어 복사
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold text-fg-2 hover:text-brand"
          onClick={async () => {
            setManualPaste(true);
            setMessage("아래에 단어를 붙여넣으세요.");
            try {
              merge(await navigator.clipboard.readText());
            } catch {
              setManualPaste(true);
              setMessage("아래에 단어를 붙여넣으세요.");
            }
          }}
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> 단어 붙여넣기
        </button>
        {message && (
          <span role="status" className="text-fg-3">
            {message}
          </span>
        )}
      </div>
      {manualPaste && (
        <div className="space-y-2">
          <textarea
            aria-label="README 검사 단어 붙여넣기"
            className="w-full rounded-xl bg-chip px-4 py-3 text-[14px] text-fg focus:outline-none focus:ring-2 focus:ring-brand/30"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-chip px-3 py-2 text-[12px] font-semibold text-fg"
            onClick={() => merge(text)}
          >
            단어 추가
          </button>
        </div>
      )}
    </div>
  );
}
