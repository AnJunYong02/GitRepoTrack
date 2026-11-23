import type { ReactNode } from "react";
import { StudentSidebar, type StudentSidebarProps } from "@/components/student/student-sidebar";

/** 학생 화면 공통 틀: 왼쪽 사이드바 + 오른쪽 본문 (플랫 디자인) */
export function StudentShell({ sidebar, children }: { sidebar: StudentSidebarProps; children: ReactNode }) {
  return (
    // 데스크톱 사이드바는 fixed(평소 64px 아이콘 줄)라서 본문 왼쪽에 그만큼 자리를 비움
    <div className="min-h-screen bg-canvas font-display text-fg antialiased lg:pl-16">
      <StudentSidebar {...sidebar} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-[72px] lg:py-12">
        <div className="mx-auto w-full max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
