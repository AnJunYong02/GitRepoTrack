import Link from "next/link";
import { ArrowRight, CalendarClock, ExternalLink, FileText, FolderGit2, GitCommit } from "lucide-react";
import type { StudentRepoItemData } from "@/components/student/student-repo-list";
import { AssignmentStats, buildAssignmentStats, DeadlineState } from "@/lib/student/assignment-stats";

interface StudentFocusDashboardProps {
  current: StudentRepoItemData;
  previous: StudentRepoItemData | null;
  nowMs: number;
}

const MAX_KEYWORD_CHIPS = 6;

// 상태별 색상 (기존 목록 배지 팔레트와 동일)
const TONE = {
  ok: { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  warn: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  bad: { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  idle: { text: "text-slate-400", bar: "bg-slate-300 dark:bg-slate-700" },
} as const;
type Tone = keyof typeof TONE;

const DEADLINE_BADGE: Record<DeadlineState, { label: string; cls: string } | null> = {
  none: null,
  open: { label: "진행 중", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300" },
  onTime: { label: "✓ 기한 내 제출", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300" },
  late: { label: "⏰ 지각 제출", cls: "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300" },
  overdue: { label: "⏰ 기한 경과", cls: "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300" },
};

function commitView(stats: AssignmentStats): { tone: Tone; value: string; note: string } {
  const { commit } = stats;
  if (!stats.analyzed) return { tone: "idle", value: "-", note: "분석 필요" };
  const value = `${commit.current}/${commit.target}개 (${commit.percent}%)`;
  if (commit.satisfied) return { tone: "ok", value, note: "✓ 충족" };
  if (commit.current === 0) return { tone: "bad", value, note: "✕ 커밋 없음" };
  return { tone: "warn", value, note: `⚠ ${commit.shortfall}개 부족` };
}

function readmeView(stats: AssignmentStats): { tone: Tone; value: string; note: string } {
  const { readme } = stats;
  if (!stats.analyzed) return { tone: "idle", value: "-", note: "분석 필요" };
  if (readme.total === 0) {
    return readme.satisfied
      ? { tone: "ok", value: "README 확인됨", note: "✓ 충족" }
      : { tone: "warn", value: "README 없음", note: "⚠ README.md 누락" };
  }
  const value = `${readme.passed}/${readme.total}개 (${readme.percent}%)`;
  if (readme.satisfied) return { tone: "ok", value, note: "✓ 충족" };
  return { tone: "warn", value, note: `⚠ ${readme.total - readme.passed}개 부족` };
}

function formatDday(daysLeft: number | null): string {
  if (daysLeft === null) return "";
  if (daysLeft <= 0) return `D+${Math.abs(daysLeft)}`;
  return daysLeft === 1 ? "D-Day" : `D-${daysLeft - 1}`;
}

/** 얇은 진행 바 */
function StatBar({ percent, tone, size = "md" }: { percent: number; tone: Tone; size?: "sm" | "md" }) {
  return (
    <div
      className={`w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden ${size === "md" ? "h-2.5" : "h-1.5"}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${TONE[tone].bar}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function DeadlineLine({ stats, compact = false }: { stats: AssignmentStats; compact?: boolean }) {
  const { deadline } = stats;
  if (!deadline.at) return <span className="text-slate-400">마감 미설정</span>;
  const badge = DEADLINE_BADGE[deadline.state];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {deadline.state === "open" && (
        <strong className={`${compact ? "text-xs" : "text-sm"} text-blue-600 dark:text-blue-400`}>
          {formatDday(deadline.daysLeft)}
        </strong>
      )}
      <span className="text-slate-500">{new Date(deadline.at).toLocaleString("ko-KR")}</span>
      {badge && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      )}
    </span>
  );
}

/** 학생 대시보드 상단: 이번주(최신) 과제를 크게, 직전 과제를 작게 보여준다 */
export function StudentFocusDashboard({ current, previous, nowMs }: StudentFocusDashboardProps) {
  const stats = buildAssignmentStats(current, nowMs);
  const commit = commitView(stats);
  const readme = readmeView(stats);
  const missing = stats.readme.missing;

  return (
    <div className="space-y-3">
      {/* 이번주 과제 */}
      <section
        aria-label="이번주 과제"
        className="rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
              이번주 과제
            </span>
            <h2 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {current.assignmentTitle}
            </h2>
            <a
              href={`https://github.com/${current.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
              <span>{current.fullName}</span>
              <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
            </a>
          </div>
          <Link
            href={`/dashboard/${current.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shrink-0"
          >
            <span>분석 대시보드</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!stats.analyzed && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-3 text-xs text-slate-500">
            아직 분석 전입니다. [분석 대시보드]에서 분석을 실행하면 부족한 항목이 표시됩니다.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 커밋 */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <GitCommit className="w-4 h-4" /> 커밋 수
              </span>
              <span className={`font-semibold ${TONE[commit.tone].text}`}>{commit.note}</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{commit.value}</div>
            <StatBar percent={stats.commit.percent} tone={commit.tone} />
          </div>

          {/* README 키워드 */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <FileText className="w-4 h-4" /> README 키워드
              </span>
              <span className={`font-semibold ${TONE[readme.tone].text}`}>{readme.note}</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{readme.value}</div>
            <StatBar percent={stats.readme.percent} tone={readme.tone} />
            {stats.analyzed && missing.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {missing.slice(0, MAX_KEYWORD_CHIPS).map((k) => (
                  <span
                    key={k}
                    className="rounded bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-300"
                  >
                    {k}
                  </span>
                ))}
                {missing.length > MAX_KEYWORD_CHIPS && (
                  <span className="px-1 text-[11px] text-slate-400">외 {missing.length - MAX_KEYWORD_CHIPS}개</span>
                )}
              </div>
            )}
          </div>

          {/* 마감 */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <CalendarClock className="w-4 h-4" /> 마감기한
            </div>
            <div className="text-xs">
              <DeadlineLine stats={stats} />
            </div>
          </div>
        </div>
      </section>

      {/* 직전 과제 (1개) */}
      {previous && <PreviousAssignmentCard item={previous} nowMs={nowMs} />}
    </div>
  );
}

function PreviousAssignmentCard({ item, nowMs }: { item: StudentRepoItemData; nowMs: number }) {
  const stats = buildAssignmentStats(item, nowMs);
  const commit = commitView(stats);
  const readme = readmeView(stats);

  return (
    <section
      aria-label="직전 과제"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
            직전 과제
          </span>
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.assignmentTitle}</h3>
        </div>
        <Link
          href={`/dashboard/${item.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>분석 대시보드</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-slate-500">
              <GitCommit className="w-3.5 h-3.5" /> 커밋 {commit.value}
            </span>
            <span className={`font-semibold ${TONE[commit.tone].text}`}>{commit.note}</span>
          </div>
          <StatBar percent={stats.commit.percent} tone={commit.tone} size="sm" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-slate-500">
              <FileText className="w-3.5 h-3.5" /> README {readme.value}
            </span>
            <span className={`font-semibold ${TONE[readme.tone].text}`}>{readme.note}</span>
          </div>
          <StatBar percent={stats.readme.percent} tone={readme.tone} size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <CalendarClock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <DeadlineLine stats={stats} compact />
        </div>
      </div>
    </section>
  );
}
