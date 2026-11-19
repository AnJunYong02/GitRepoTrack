import Link from "next/link";
import { ArrowRight, CalendarClock, ExternalLink, FileText, FolderGit2, GitCommit } from "lucide-react";
import type { StudentRepoItemData } from "@/components/student/student-repo-list";
import { AssignmentStats, buildAssignmentStats, DeadlineState } from "@/lib/student/assignment-stats";

interface StudentFocusDashboardProps {
  current: StudentRepoItemData;
  nowMs: number;
}

const MAX_KEYWORD_CHIPS = 6;

// 상태별 색상 (기존 목록 배지 팔레트와 동일)
const TONE = {
  ok: { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  warn: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  bad: { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  idle: { text: "text-muted", bar: "bg-muted/40" },
} as const;
type Tone = keyof typeof TONE;

const DEADLINE_BADGE: Record<DeadlineState, { label: string; cls: string } | null> = {
  none: null,
  open: { label: "진행 중", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300" },
  onTime: { label: "✓ 기한 내 제출", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300" },
  late: { label: "⏰ 지각 제출", cls: "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300" },
  overdue: { label: "⏰ 기한 경과", cls: "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300" },
};

const CARD = "rounded-[28px] bg-surface shadow-neu";
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";

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
      className={`w-full rounded-full shadow-neu-inset overflow-hidden ${size === "md" ? "h-2.5" : "h-1.5"}`}
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
  if (!deadline.at) return <span className="text-muted">마감 미설정</span>;
  const badge = DEADLINE_BADGE[deadline.state];
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-2">
      {deadline.state === "open" && (
        <strong className={`${compact ? "text-xs" : "text-sm"} text-blue-600 dark:text-blue-400`}>
          {formatDday(deadline.daysLeft)}
        </strong>
      )}
      <span className="text-muted">{new Date(deadline.at).toLocaleString("ko-KR")}</span>
      {badge && (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      )}
    </span>
  );
}

/** 숫자 타일 (사진의 ACTIVE GOALS / BLOCKED TASKS 칸) */
function NumberTile({
  label,
  icon,
  value,
  valueTone,
  caption,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  valueTone: Tone;
  caption: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className={`${LABEL} inline-flex items-center gap-1.5`}>
        {icon}
        {label}
      </span>
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl shadow-neu-inset">
        <span
          className={`text-4xl font-light tracking-tight ${
            valueTone === "idle" ? "text-muted" : valueTone === "bad" ? TONE.bad.text : "text-ink"
          }`}
        >
          {value}
        </span>
      </div>
      <div className="space-y-1 text-xs text-ink/80">{caption}</div>
      {children}
    </div>
  );
}

/** 학생 대시보드 상단: 이번주(최신) 과제 통계 (전체 폭 가로 카드) */
export function StudentFocusDashboard({ current, nowMs }: StudentFocusDashboardProps) {
  const stats = buildAssignmentStats(current, nowMs);
  const commit = commitView(stats);
  const readme = readmeView(stats);
  const missing = stats.readme.missing;

  const readmeNumber = !stats.analyzed
    ? "-"
    : stats.readme.total > 0
    ? String(stats.readme.passed)
    : stats.readme.satisfied
    ? "✓"
    : "✕";
  const deadlineNumber = !stats.deadline.at
    ? "-"
    : stats.deadline.state === "open" || stats.deadline.state === "overdue"
    ? formatDday(stats.deadline.daysLeft)
    : stats.deadline.state === "onTime"
    ? "✓"
    : "지각";

  return (
    <section aria-label="이번주 과제" className={`${CARD} neu-hover p-6 sm:p-8`}>
      {/* xl 이상: 왼쪽 과제 정보 · 오른쪽 숫자 타일 3개를 한 줄로 */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] xl:items-center">
        <div className="flex min-w-0 flex-col items-start gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              이번주 과제
            </span>
            <h2 className="mt-2 text-2xl font-normal tracking-tight text-ink">{current.assignmentTitle}</h2>
            <a
              href={`https://github.com/${current.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 break-all font-mono text-xs text-muted hover:text-ink hover:underline"
            >
              <FolderGit2 className="h-3.5 w-3.5 shrink-0" />
              <span>{current.fullName}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
            </a>
          </div>
          <Link
            href={`/dashboard/${current.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink shadow-neu-sm transition hover:shadow-neu-inset"
          >
            <span>분석 대시보드</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 xl:border-l xl:border-muted/20 xl:pl-8">
          <NumberTile
            label="커밋"
            icon={<GitCommit className="h-3.5 w-3.5" />}
            value={stats.analyzed ? String(stats.commit.current) : "-"}
            valueTone={commit.tone}
            caption={
              <>
                <div>{stats.analyzed ? `기준 ${stats.commit.target}개 · ${stats.commit.percent}%` : commit.value}</div>
                <div className={`font-semibold ${TONE[commit.tone].text}`}>{commit.note}</div>
              </>
            }
          />
          <NumberTile
            label="README 키워드"
            icon={<FileText className="h-3.5 w-3.5" />}
            value={readmeNumber}
            valueTone={readme.tone}
            caption={
              <>
                <div>{readme.value}</div>
                <div className={`font-semibold ${TONE[readme.tone].text}`}>{readme.note}</div>
              </>
            }
          >
            {stats.analyzed && missing.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1">
                {missing.slice(0, MAX_KEYWORD_CHIPS).map((k) => (
                  <span
                    key={k}
                    className="rounded-lg bg-amber-100/70 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  >
                    {k}
                  </span>
                ))}
                {missing.length > MAX_KEYWORD_CHIPS && (
                  <span className="px-1 text-[11px] text-muted">외 {missing.length - MAX_KEYWORD_CHIPS}개</span>
                )}
              </div>
            )}
          </NumberTile>
          <NumberTile
            label="마감기한"
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            value={deadlineNumber}
            valueTone={!stats.deadline.at ? "idle" : stats.deadline.state === "onTime" || stats.deadline.state === "open" ? "ok" : "bad"}
            caption={<DeadlineLine stats={stats} compact />}
          />
        </div>

      </div>

      {!stats.analyzed && (
        <p className="mt-6 rounded-2xl px-4 py-3 text-xs text-muted shadow-neu-inset">
          아직 분석 전입니다. [분석 대시보드]에서 분석을 실행하면 부족한 항목이 표시됩니다.
        </p>
      )}
    </section>
  );
}

/** 직전 과제 요약 (과제 목록 카드 맨 위의 들어간 박스로 사용) */
export function PreviousAssignmentCard({ item, nowMs }: { item: StudentRepoItemData; nowMs: number }) {
  const stats = buildAssignmentStats(item, nowMs);
  const commit = commitView(stats);
  const readme = readmeView(stats);

  return (
    <section aria-label="직전 과제" className="space-y-3 rounded-3xl p-4 shadow-neu-inset">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={LABEL}>직전 과제</p>
          <h3 className="mt-1 truncate text-sm font-medium text-ink">{item.assignmentTitle}</h3>
        </div>
        <Link
          href={`/dashboard/${item.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink/80 hover:text-ink hover:underline"
        >
          <span>분석 대시보드</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-muted">
              <GitCommit className="h-3.5 w-3.5" /> 커밋 {commit.value}
            </span>
            <span className={`font-semibold ${TONE[commit.tone].text}`}>{commit.note}</span>
          </div>
          <StatBar percent={stats.commit.percent} tone={commit.tone} size="sm" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-muted">
              <FileText className="h-3.5 w-3.5" /> README {readme.value}
            </span>
            <span className={`font-semibold ${TONE[readme.tone].text}`}>{readme.note}</span>
          </div>
          <StatBar percent={stats.readme.percent} tone={readme.tone} size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted" />
          <DeadlineLine stats={stats} compact />
        </div>
      </div>
    </section>
  );
}
