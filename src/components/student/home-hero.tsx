import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buildAssignmentStats } from "@/lib/student/assignment-stats";
import { getDeadlineMark, getItemStatus, type StudentRepoItemData } from "@/lib/student/student-assignments";
import { formatKstDateTime, formatKstMonthDay, kstDaysUntil } from "@/lib/student/time-utils";

type RowTone = "ok" | "bad" | "idle";

// 상태 문구 글자색 (아이콘 없이 색으로만 구분)
const ROW_TONE: Record<RowTone, string> = {
  ok: "text-brand",
  bad: "text-danger",
  idle: "text-fg-3",
};

function CheckRow({ label, tone, status, value }: { label: string; tone: RowTone; status: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-5 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
      <span className="text-[15px] font-semibold text-fg-2">{label}</span>
      <span className={`truncate text-[19px] font-bold ${ROW_TONE[tone]}`}>{status}</span>
      <span className="text-right text-[13px] tabular-nums text-fg-3">{value}</span>
    </div>
  );
}

const DAY_MS = 86_400_000;

/** 메인 대시보드 상단: 이번 주 과제 요약 (헤드라인 · 조건 3행 · 분석 대시보드 버튼) */
export function HomeHero({ item, nowMs }: { item: StudentRepoItemData; nowMs: number }) {
  const stats = buildAssignmentStats(item, nowMs);
  const status = getItemStatus(item);

  // 커밋 행
  const commitRow: { tone: RowTone; status: string } = !stats.analyzed
    ? { tone: "idle", status: "분석 전" }
    : stats.commit.satisfied
    ? { tone: "ok", status: "기준 충족" }
    : stats.commit.current === 0
    ? { tone: "bad", status: "커밋 없음" }
    : { tone: "bad", status: `${stats.commit.shortfall}개 부족` };

  // README 행
  const readmeRow: { tone: RowTone; status: string; value: string } = !stats.analyzed
    ? { tone: "idle", status: "분석 전", value: stats.readme.total > 0 ? `- / ${stats.readme.total}개` : "-" }
    : stats.readme.total === 0
    ? {
        tone: stats.readme.satisfied ? "ok" : "bad",
        status: stats.readme.satisfied ? "README 확인됨" : "README 누락",
        value: "-",
      }
    : {
        tone: stats.readme.satisfied ? "ok" : "bad",
        status: stats.readme.satisfied ? "키워드 충족" : `${stats.readme.total - stats.readme.passed}개 미사용`,
        value: `${stats.readme.passed} / ${stats.readme.total}개`,
      };

  // 마감 행
  const { deadline } = stats;
  const mark = getDeadlineMark(item, nowMs);
  const daysLeft = deadline.at ? kstDaysUntil(deadline.at, nowMs) : null;
  const deadlineRow: { tone: RowTone; status: string } =
    mark === "onTime"
      ? { tone: "ok", status: "기한 내 제출" }
      : mark === "late"
      ? { tone: "bad", status: "지각 제출" }
      : mark === "missing"
      ? { tone: "bad", status: "미제출" }
      : mark === "open"
      ? { tone: "idle", status: daysLeft ? `D-${daysLeft} 진행 중` : "오늘 마감" }
      : { tone: "idle", status: "마감 없음" };

  // 기간: 마감 6일 전 ~ 마감일 (주 단위 과제)
  const period = deadline.at
    ? `${formatKstMonthDay(new Date(new Date(deadline.at).getTime() - 6 * DAY_MS).toISOString(), true)} ~ ${formatKstMonthDay(deadline.at, true)}`
    : null;
  const isOpen = deadline.at ? new Date(deadline.at).getTime() > nowMs : false;

  const subject = item.preserveTitle ? `${item.assignmentTitle},` : item.weekNo !== null ? `${item.weekNo}주차 과제,` : `${item.assignmentTitle},`;

  return (
    <section aria-label="이번 주 과제" className="grid grid-cols-1 items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)_auto] xl:gap-14">
      {/* 헤드라인 */}
      <div className="space-y-6">
        <h2 className="text-[34px] font-bold leading-[1.25] tracking-[-0.03em] text-fg sm:text-[40px]">
          <span className="text-fg-3">이번</span> {subject}
          <br />
          {status === "satisfied" ? (
            <>
              조건을 <span className="text-brand">모두 충족</span>했어요.
            </>
          ) : status === "unmet" ? (
            <>
              조건 <span className="text-danger">보완이 필요</span>해요.
            </>
          ) : (
            <>
              아직 <span className="text-fg-3">분석 전</span>이에요.
            </>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-[14px] text-fg-2">
          {deadline.at && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                isOpen ? "bg-brand-soft text-brand" : "bg-chip text-fg-3"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-brand" : "bg-fg-3"}`} />
              {isOpen ? "진행 중" : "마감"}
            </span>
          )}
          {period && <span>{period}</span>}
        </div>
      </div>

      {/* 조건 3행 */}
      <div>
        <CheckRow
          label="커밋"
          tone={commitRow.tone}
          status={commitRow.status}
          value={stats.analyzed ? `${stats.commit.current} / ${stats.commit.target}개` : `- / ${stats.commit.target}개`}
        />
        <CheckRow label="README 키워드" tone={readmeRow.tone} status={readmeRow.status} value={readmeRow.value} />
        <CheckRow
          label="마감기한"
          tone={deadlineRow.tone}
          status={deadlineRow.status}
          value={deadline.at ? formatKstDateTime(deadline.at) : "-"}
        />
      </div>

      {/* 이동 버튼 */}
      <Link
        href={`/dashboard/${item.id}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-brand px-6 py-3.5 text-[14px] font-semibold text-white transition hover:brightness-110"
      >
        이번 주 분석 대시보드
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
