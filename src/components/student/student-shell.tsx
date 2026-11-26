import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { StudentSidebar, type StudentSidebarProps } from "@/components/student/student-sidebar";
import { SIDEBAR_COOKIE } from "@/components/student/sidebar-cookie";

/** 학생 화면 공통 틀: 왼쪽 사이드바 + 오른쪽 본문 (플랫 디자인) */
export async function StudentShell({ sidebar, children }: { sidebar: StudentSidebarProps; children: ReactNode }) {
  // 버튼으로 고정한 열림/닫힘 상태를 쿠키에서 읽어 첫 화면부터 그대로 그림 (깜빡임 방지)
  const defaultOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value === "open";

  return (
    // 데스크톱 사이드바는 fixed라서 본문 왼쪽에 사이드바 폭(닫힘 64px / 열림 232px)만큼 자리를 비움
    <div className="min-h-screen bg-canvas font-display text-fg antialiased lg:pl-16 lg:transition-[padding] lg:duration-200 lg:ease-out lg:has-[[data-sidebar-open=true]]:pl-[232px]">
      <StudentSidebar {...sidebar} defaultOpen={defaultOpen} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-[72px] lg:py-12">
        <div className="mx-auto w-full max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
