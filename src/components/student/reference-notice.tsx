import { Info } from "lucide-react";

interface ReferenceNoticeProps {
  /** 무엇이 참고용인지 (예: "이 분석 결과", "이 순위표") */
  subject: string;
  /** 채점 점수와 다를 수 있는 대상 (예: "분석 결과", "순위·분석 결과") */
  target?: string;
}

/**
 * "참고용" 안내 문구.
 * 자동 분석 결과·순위가 실제 과제 채점 점수와 다를 수 있음을 강조한다.
 * hooks가 없어 서버·클라이언트 컴포넌트 어디서든 쓸 수 있다.
 */
export function ReferenceNotice({ subject, target = "분석 결과" }: ReferenceNoticeProps) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl bg-amber-400/10 p-4 shadow-neu-inset"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          <span className="rounded-full bg-amber-400/25 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">
            참고용
          </span>
          <span>{subject}는 참고용입니다.</span>
            <p className="text-muted">
                여기 표시되는 {target}는 <strong className="font-semibold text-ink">실제 과제 채점 점수와 다를 수 있습니다.</strong>{" "}
            </p>
        </p>

      </div>
    </div>
  );
}
