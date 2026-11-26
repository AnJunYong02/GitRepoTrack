import { describe, expect, it } from "vitest";
import { summarizeStatusRows, toStudentStatusRow } from "./student-status-rows";

const row = (overrides: any = {}) => ({
  id: "r1",
  student_no: "22100063",
  full_name: "2026-2-WebService/assign12-c01-22100063",
  commits: [{ committed_at: "2026-11-23T07:15:00Z" }, { committed_at: "2026-11-20T01:00:00Z" }],
  repo_status: {
    latest_snapshot_id: "s1",
    snapshots: {
      commit_count: 5,
      observed_at: "2026-11-23T08:00:00Z",
      evaluations: [{ readme_results: { satisfied: false, details: [{ found: true }, { found: false }, { found: true }] } }],
    },
  },
  ...overrides,
});

describe("toStudentStatusRow", () => {
  it("커밋이 있으면 제출, 기준 대비 충족 여부와 README 개수를 계산", () => {
    const r = toStudentStatusRow(row(), 3, []);
    expect(r.submitState).toBe("submitted");
    expect(r.repoName).toBe("assign12-c01-22100063");
    expect(r.commitCount).toBe(5);
    expect(r.commitsMet).toBe(true);
    expect([r.readmePassed, r.readmeTotal, r.readmeShown]).toEqual([2, 3, true]);
    expect(r.lastPushAt).toBe("2026-11-23T07:15:00.000Z");
  });

  it("분석 전이면 분석 대기, README는 표시하지 않음", () => {
    const r = toStudentStatusRow(row({ repo_status: null, commits: [] }), 3, ["A", "B"]);
    expect(r.submitState).toBe("pending");
    expect(r.readmeShown).toBe(false);
    expect(r.lastPushAt).toBeNull();
  });

  it("분석됐지만 커밋이 없으면 미제출", () => {
    const r = toStudentStatusRow(
      row({ commits: [], repo_status: { latest_snapshot_id: "s1", snapshots: { commit_count: 0, evaluations: [] } } }),
      3,
      ["A"]
    );
    expect(r.submitState).toBe("unsubmitted");
    expect(r.commitsMet).toBe(false);
  });

  it("평가 details가 없으면 현재 키워드 수를 기준으로, satisfied면 전부 통과", () => {
    const r = toStudentStatusRow(
      row({
        repo_status: {
          latest_snapshot_id: "s1",
          snapshots: { commit_count: 2, evaluations: { readme_results: { satisfied: true } } },
        },
      }),
      0,
      ["A", "B", "C"]
    );
    expect([r.readmePassed, r.readmeTotal]).toEqual([3, 3]);
    expect(r.commitsMet).toBe(true); // 기준 없음 → 커밋 1개 이상이면 충족
  });

  it("커밋 목록이 없으면 스냅샷 관측 시각을 마지막 push로", () => {
    const r = toStudentStatusRow(row({ commits: [] }), 3, []);
    expect(r.lastPushAt).toBe("2026-11-23T08:00:00.000Z");
  });
});

describe("summarizeStatusRows", () => {
  it("배정·제출·분석 대기·미제출 수", () => {
    expect(
      summarizeStatusRows([
        { submitState: "submitted" },
        { submitState: "submitted" },
        { submitState: "pending" },
        { submitState: "unsubmitted" },
      ])
    ).toEqual({ total: 4, submitted: 2, pending: 1, unsubmitted: 1 });
  });
});

describe("toStudentStatusRow - 명단 정보", () => {
  it("학생 관리 명단 값을 우선한다", () => {
    const r = toStudentStatusRow(
      row({ student_name: "예전이름", profiles: { github_login: "old-login" } }),
      3,
      [],
      { name: "홍길동", githubLogin: "octocat" }
    );
    expect(r.studentName).toBe("홍길동");
    expect(r.githubLogin).toBe("octocat");
  });

  it("명단이 없으면 student_name과 프로필 로그인으로 대체한다", () => {
    const r = toStudentStatusRow(row({ student_name: "김철수", profiles: { github_login: "kim" } }), 3, []);
    expect(r.studentName).toBe("김철수");
    expect(r.githubLogin).toBe("kim");
  });

  it("명단에 GitHub ID가 비어 있으면 프로필 로그인을 쓴다", () => {
    const r = toStudentStatusRow(row({ profiles: { github_login: "kim" } }), 3, [], { name: "김철수", githubLogin: null });
    expect(r.githubLogin).toBe("kim");
  });

  it("아무 정보도 없으면 null", () => {
    const r = toStudentStatusRow(row(), 3, []);
    expect(r.studentName).toBeNull();
    expect(r.githubLogin).toBeNull();
  });
});
