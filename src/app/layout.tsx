import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { RouteHistoryTracker } from "@/components/navigation/route-history";

export const metadata: Metadata = {
  title: "GitRepoTrack - Github Repo 분석 서비스",
  description: "GitHub Organization 기반 Repo 분석 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 화면이 그려지기 전에 테마 적용 (저장된 선택 → 없으면 OS 설정). 깜빡임 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("repotrack-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        {/* 직전 URL 기록: "뒤로가기" 버튼이 이전 화면을 즉시 복원할 수 있는지 판단용 */}
        <Suspense fallback={null}>
          <RouteHistoryTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
