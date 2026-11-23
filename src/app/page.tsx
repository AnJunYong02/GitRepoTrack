import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { LandingThemeButton } from "@/components/landing-theme-button";
import { GitHubLoginButton } from "@/components/github-login-button";

/** 오른쪽 "미리보기" 예시 (실제 데이터 아님 — 로그인 전이라 DB를 조회하지 않음) */
const PREVIEW_ROWS: { label: string; ok: boolean; status: string; value: string }[] = [
  { label: "커밋", ok: true, status: "기준 충족", value: "7 / 1개" },
  { label: "README 키워드", ok: false, status: "키워드 부족", value: "5 / 12개" },
  { label: "마감기한", ok: true, status: "기한 내 제출", value: "11월 24일 오전 2:48" },
];

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  // 이미 로그인했으면 바로 대시보드로
  const current = await getCurrentUser();
  if (current) {
    redirect("/dashboard");
  }
  // 로그인 콜백 실패 시 /?error=… 로 돌아옴
  const loginError = (searchParams ? await searchParams : undefined)?.error ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-display text-fg antialiased">
      {/* 헤더: 로고 + 다크 모드 */}
      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-6 sm:px-10 lg:px-[75px]">
        <span className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          <span className="text-[19px] font-bold tracking-tight">GitRepoTrack</span>
        </span>
        <LandingThemeButton />
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-center gap-16 px-6 pb-24 pt-10 sm:px-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-16 lg:px-[75px] lg:pb-40">
        {/* 왼쪽: 소개 */}
        <section className="space-y-8">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-chart">
            <span className="h-2 w-2 rounded-full bg-chart" aria-hidden />
            학생 과제 분석 시스템
          </p>
          {/* 넓은 화면(xl~)에서는 시안처럼 정확히 2줄, 좁은 화면은 자연스럽게 줄바꿈 */}
          <h1 className="text-[36px] font-bold leading-[1.2] tracking-[-0.03em] sm:text-[48px] xl:text-[44px] 2xl:text-[52px]">
            <span className="xl:whitespace-nowrap">GitHub Organization 과제,</span>
            <br />
            <span className="xl:whitespace-nowrap">
              <span className="text-brand">제출 조건</span>까지 한눈에.
            </span>
          </h1>
          <p className="text-[15px] leading-[1.8] text-fg-2 sm:text-[17px]">
            학생은 자신의 repo 현황과 README 충족 여부를 확인하고,
            <br className="hidden sm:block" /> TA와 교수는 전체 제출 현황 파악과 ZIP 일괄 다운로드를 손쉽게 할 수 있어요.
          </p>
          {/* 누르면 바로 GitHub 로그인 창으로 이동 */}
          <GitHubLoginButton initialError={loginError} />
        </section>

        {/* 오른쪽: 학생 화면 미리보기 */}
        <section aria-label="학생 화면 미리보기" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[13px] text-fg-3">미리보기</p>
              <p className="text-[22px] font-bold tracking-tight">학생은 이렇게 확인해요</p>
            </div>
            <p className="flex items-center gap-1.5 pb-1 text-[13px] font-semibold text-chart">
              <span className="h-2 w-2 rounded-full bg-chart" aria-hidden />
              이번 12주차 과제
            </p>
          </div>
          <div>
            {PREVIEW_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-6 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)_auto]"
              >
                <span className="text-[15px] font-semibold text-fg-2">{row.label}</span>
                <span className={`inline-flex items-center gap-2.5 text-[19px] font-bold ${row.ok ? "text-brand" : "text-danger"}`}>
                  <span
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-white ${
                      row.ok ? "bg-brand" : "bg-danger"
                    }`}
                    aria-hidden
                  >
                    {row.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="text-[14px] font-bold">!</span>}
                  </span>
                  <span className="truncate">{row.status}</span>
                </span>
                <span className="text-right text-[13px] tabular-nums text-fg-3">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
