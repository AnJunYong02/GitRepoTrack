// 관리자 화면 과제 제목 표시: "과제 12차 (assign12)" → "과제 12주차" + 중간고사 여부 (순수 함수)
import { extractWeekNo } from "@/lib/student/student-assignments";

export interface AssignmentTitleView {
  /** 화면에 보일 제목 (주차를 모르면 원래 제목) */
  label: string;
  isMidterm: boolean;
}

export function formatAssignmentTitle(title: string | null | undefined, category?: string | null): AssignmentTitleView {
  const raw = (title || "").trim();
  const source = `${raw} ${category || ""}`;
  const isMidterm = /midterm|중간/i.test(source);
  const weekNo = extractWeekNo(null, raw) ?? extractWeekNo(null, category || "");
  return { label: weekNo !== null ? `과제 ${weekNo}주차` : raw || "과제", isMidterm };
}
