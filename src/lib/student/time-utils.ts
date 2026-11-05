const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2시간 전", "방금 전", "3일 전" 형태의 상대 시간. 7일 이상이면 null (절대 시각만 표시). */
export function formatRelativeTime(iso: string, nowMs: number): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = nowMs - t;
  if (diff < 0) return "방금 전";
  if (diff < MINUTE) return "방금 전";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  return null;
}

/** KST 기준 "10.30 15:42" 형태의 절대 시각. */
export function formatAbsoluteKst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

export interface Countdown {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  label: string;
}

/** 마감까지 남은 시간 계산. 예: "D-3일 14시간", "D-Day 5시간 20분", "마감 종료". */
export function computeCountdown(deadlineIso: string, nowMs: number): Countdown {
  const deadline = new Date(deadlineIso).getTime();
  const diff = deadline - nowMs;
  if (Number.isNaN(deadline) || diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, label: "마감 종료" };
  }
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const minutes = Math.floor((diff % HOUR) / MINUTE);
  const label =
    days >= 1 ? `D-${days}일 ${hours}시간` : `D-Day ${hours}시간 ${minutes}분`;
  return { expired: false, days, hours, minutes, label };
}

export type DeadlineBadgeKind = "on_time_submitted" | "on_time_partial" | "late" | "none";

/** 최종 커밋이 마감 기한 내에 들어갔는지 판정. */
export function getDeadlineBadgeKind(params: {
  deadlineIso: string | null;
  commitDates: string[];
  isSubmitted: boolean;
}): DeadlineBadgeKind {
  const { deadlineIso, commitDates, isSubmitted } = params;
  const times = commitDates
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return "none";
  const latest = Math.max(...times);
  if (deadlineIso) {
    const deadline = new Date(deadlineIso).getTime();
    if (!Number.isNaN(deadline) && latest > deadline) return "late";
  }
  return isSubmitted ? "on_time_submitted" : "on_time_partial";
}

/** 키워드를 "## 키워드\n\n" 마크다운 대제목 양식으로 변환. */
export function buildMarkdownHeadings(keywords: string[]): string {
  return keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => `## ${k}\n\n`)
    .join("");
}

/** 커밋 메시지를 제목(첫 줄)과 본문으로 분리. */
export function splitCommitMessage(message: string | null | undefined): {
  title: string;
  body: string;
} {
  const text = (message || "").trim();
  if (!text) return { title: "(커밋 메시지 없음)", body: "" };
  const idx = text.indexOf("\n");
  if (idx === -1) return { title: text, body: "" };
  return { title: text.slice(0, idx).trim(), body: text.slice(idx + 1).trim() };
}
