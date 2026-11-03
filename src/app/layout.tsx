import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoTrack - 학생 과제 Repo 분석 서비스",
  description: "GitHub Organization 기반 학생 과제 제출 및 분석 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
