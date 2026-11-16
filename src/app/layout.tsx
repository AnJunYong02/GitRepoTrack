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
    <html lang="ko">
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
