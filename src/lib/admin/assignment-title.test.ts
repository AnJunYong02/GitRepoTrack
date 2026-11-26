import { describe, expect, it } from "vitest";
import { formatAssignmentTitle } from "./assignment-title";

describe("formatAssignmentTitle", () => {
  it("여러 제목 형식을 '과제 N주차'로", () => {
    expect(formatAssignmentTitle("과제 12차 (assign12)")).toEqual({ label: "과제 12주차", isMidterm: false });
    expect(formatAssignmentTitle("assign09")).toEqual({ label: "과제 9주차", isMidterm: false });
    expect(formatAssignmentTitle("10주차 과제")).toEqual({ label: "과제 10주차", isMidterm: false });
  });
  it("중간고사 표시", () => {
    expect(formatAssignmentTitle("과제 8차 중간고사 (assign08_midterm)")).toEqual({ label: "과제 8주차", isMidterm: true });
    expect(formatAssignmentTitle("과제", "assign08_midterm")).toEqual({ label: "과제 8주차", isMidterm: true });
  });
  it("주차를 못 찾으면 원래 제목", () => {
    expect(formatAssignmentTitle("기말 프로젝트")).toEqual({ label: "기말 프로젝트", isMidterm: false });
  });
});
