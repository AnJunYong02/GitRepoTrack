"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invalidateOrgReposSessionCache } from "@/lib/cache/session-cache";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FolderPlus,
  Info,
  Plus,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

interface PreviewStudent {
  studentNo: string;
  name: string;
  githubLogin: string | null;
  /** GitHub ID 출처: CSV 열 / 이전 과제 repo의 collaborator / 학교 이메일 검색 */
  githubSource: "csv" | "previous-repo" | "verified-email" | "email" | null;
  sourceRepo: string | null;
  sourceEmail: string | null;
  /** GitHub ID를 못 찾은 이유 */
  missingReason: string | null;
  repoName: string | null;
  exists: boolean;
}

interface PreviewData {
  rosterConfigured: boolean;
  /** 명단을 읽은 곳: 로컬 파일(secrets/roster.csv) / 환경변수(ROSTER_CSV_BASE64) */
  rosterSource?: "file" | "env";
  error?: string;
  orgName?: string;
  prefix?: string | null;
  repoPrefix?: string | null;
  templates?: string[];
  githubWarning?: string | null;
  invalidRows?: { line: number; reason: string }[];
  students?: PreviewStudent[];
  /** 같은 접두사의 기존 과제가 있으면 그 과제에 추가된다 */
  existingAssignment?: { id: string; title: string } | null;
  suggestedTitle?: string;
}

interface ProvisionResult {
  studentNo: string;
  repoName: string;
  ok: boolean;
  created?: boolean;
  collaborator?: "added" | "invited" | "skipped";
  error?: string;
}

// 서버 create-repos 라우트의 MAX_PER_REQUEST와 같은 값 (Vercel 실행 시간 제한 대비 분할 호출)
const CHUNK_SIZE = 5;

/** datetime-local 입력 기본값: 지금부터 7일 뒤 23:59 (브라우저 현지 시간) */
function defaultDeadlineLocal(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`;
}

/** `assign09-c01-22100063` → `assign09` (배지에 짧게 표시) */
function shortAssignmentName(repoName: string | null): string {
  if (!repoName) return "이전 과제";
  return repoName.replace(/[-_]c01[-_][0-9]+$/i, "");
}

function resultLabel(r: ProvisionResult): string {
  if (!r.ok) return r.error || "실패";
  const repo = r.created ? "repo 생성" : "기존 repo";
  const collab =
    r.collaborator === "invited"
      ? "초대 보냄"
      : r.collaborator === "added"
      ? "collaborator 추가"
      : "GitHub ID 없음 · collaborator 생략";
  return `${repo} · ${collab}`;
}

function GithubLoginCell({ student }: { student: PreviewStudent }) {
  if (!student.githubLogin) {
    return (
      <span className="text-amber-600">
        없음 · collaborator 생략
        {student.missingReason && (
          <span className="block text-[10px] text-amber-700/80 dark:text-amber-300/80">
            {student.missingReason}
          </span>
        )}
      </span>
    );
  }

  const badge =
    student.githubSource === "csv"
      ? { label: "CSV", title: "명단 CSV의 GitHub 열", className: "bg-chip text-fg-2" }
      : student.githubSource === "verified-email"
      ? {
          label: "로그인 이메일",
          title: student.sourceEmail
            ? `GitRepoTrack 로그인 때 확인된 GitHub 인증 이메일(${student.sourceEmail})과 일치`
            : "GitRepoTrack 로그인 때 확인된 GitHub 인증 이메일과 일치",
          className: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
        }
      : student.githubSource === "email"
      ? {
          label: "이메일",
          title: student.sourceEmail ? `${student.sourceEmail}로 검색해 찾음` : "학교 이메일로 검색해 찾음",
          className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
        }
      : {
          label: `${shortAssignmentName(student.sourceRepo)}에서`,
          title: student.sourceRepo ? `${student.sourceRepo}의 collaborator에서 찾음` : undefined,
          className: "bg-chart/10 text-chart",
        };

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="font-mono">{student.githubLogin}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
        title={badge.title}
      >
        {badge.label}
      </span>
    </span>
  );
}

/**
 * 관리자 과제 목록 화면의 "학생 Repo 일괄 생성".
 * 과제 접두사로 과제를 찾거나 새로 만든 뒤, 학생 명단(시크릿)대로 repo를 만든다.
 */
export function CreateStudentReposPanel({
  orgName,
  trigger = "button",
  navClassName = "",
  hideClassName = "",
}: {
  orgName: string;
  /** button: 헤더의 초록 버튼, nav: 사이드바 메뉴 줄 */
  trigger?: "button" | "nav";
  /** trigger="nav"일 때 메뉴 줄 클래스 */
  navClassName?: string;
  /** trigger="nav"일 때 사이드바가 접히면 글자를 숨기는 클래스 */
  hideClassName?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  // 모달은 document.body에 그린다 (사이드바처럼 좁은 영역 안에서 열어도 화면 전체를 덮도록)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [prefixInput, setPrefixInput] = useState("");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadlineLocal);
  const [templateRepo, setTemplateRepo] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  // 생성(또는 연결)된 과제 id. 생성이 시작된 뒤에만 채워진다
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProvisionResult>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const students = preview?.students || [];
  const isNewAssignment = Boolean(preview?.rosterConfigured && !preview.existingAssignment);
  const doneCount = Object.keys(results).length;
  const failedNos = useMemo(
    () => Object.values(results).filter((r) => !r.ok).map((r) => r.studentNo),
    [results]
  );
  const canRun = Boolean(preview?.rosterConfigured && preview.prefix && students.length > 0);

  const resetForNewPrefix = (value: string) => {
    setPrefixInput(value);
    // 접두사가 바뀌면 이전 미리보기·결과는 의미가 없으므로 비운다
    setPreview(null);
    setResults({});
    setAssignmentId(null);
    setErrorMsg("");
  };

  const close = () => {
    if (running) return;
    setIsOpen(false);
    if (doneCount > 0) {
      // 새 repo가 생겼으므로 org repo 목록 브라우저 캐시를 지우고 목록 컴포넌트에 재조회를 알린다
      invalidateOrgReposSessionCache(orgName);
      router.refresh(); // 과제 목록 인원 수 갱신
    }
  };

  const loadPreview = async () => {
    setErrorMsg("");
    setLoadingPreview(true);
    setResults({});
    setAssignmentId(null);
    try {
      const params = new URLSearchParams({ org: orgName, prefix: prefixInput.trim() });
      const res = await fetch(`/api/admin/repo-provisioning?${params.toString()}`);
      const data: PreviewData = await res.json();
      if (!res.ok) throw new Error(data.error || "미리보기를 불러오지 못했습니다.");
      setPreview(data);
      setTitle(data.suggestedTitle || "");
    } catch (err: any) {
      setPreview(null);
      setErrorMsg(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  /** 과제를 찾거나 새로 만들어 id를 받는다 (이미 받았으면 재사용) */
  const ensureAssignment = async (): Promise<string> => {
    if (assignmentId) return assignmentId;
    if (isNewAssignment && !deadline) throw new Error("마감 일시를 입력해주세요.");

    const res = await fetch("/api/admin/repo-provisioning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org: orgName,
        prefix: preview?.prefix,
        title: title.trim() || undefined,
        deadlineAt: isNewAssignment ? new Date(deadline).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "과제를 준비하지 못했습니다.");
    setAssignmentId(data.assignmentId);
    return data.assignmentId as string;
  };

  const runProvision = async (targetNos: string[]) => {
    if (!preview?.prefix || targetNos.length === 0) return;
    const target = preview.existingAssignment
      ? `기존 과제 "${preview.existingAssignment.title}"`
      : `새 과제 "${title.trim() || preview.suggestedTitle}"`;
    const confirmed = window.confirm(
      `${orgName}에 private repo ${targetNos.length}개를 만들고 ${target}에 등록합니다.\n` +
        "학생별로 해당 학생만 collaborator로 추가되며, 이미 있는 repo는 새로 만들지 않습니다. 진행할까요?"
    );
    if (!confirmed) return;

    setErrorMsg("");
    setRunning(true);
    // 재시도 대상의 이전 결과는 지운다
    setResults((prev) => {
      const next = { ...prev };
      for (const no of targetNos) delete next[no];
      return next;
    });

    try {
      const id = await ensureAssignment();

      for (let i = 0; i < targetNos.length; i += CHUNK_SIZE) {
        const chunk = targetNos.slice(i, i + CHUNK_SIZE);
        const res = await fetch(`/api/admin/assignments/${id}/create-repos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prefix: preview.prefix,
            studentNos: chunk,
            templateRepo: templateRepo || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // 요청 자체가 실패하면 이번 묶음을 실패로 표시하고 중단 (나중에 재시도 가능)
          setResults((prev) => {
            const next = { ...prev };
            for (const no of chunk) {
              next[no] = { studentNo: no, repoName: "", ok: false, error: data.error || "요청 실패" };
            }
            return next;
          });
          throw new Error(data.error || "repo 생성 요청이 실패했습니다.");
        }
        setResults((prev) => {
          const next = { ...prev };
          for (const r of data.results as ProvisionResult[]) next[r.studentNo] = r;
          return next;
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setRunning(false);
    }
  };

  const triggerButton =
    trigger === "nav" ? (
      <button type="button" onClick={() => setIsOpen(true)} className={navClassName}>
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          <Plus className="h-[18px] w-[18px]" />
        </span>
        <span className={`whitespace-nowrap ${hideClassName}`}>학생 Repo 생성</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-[15px] font-bold text-white transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        학생 Repo 일괄 생성
      </button>
    );

  if (!isOpen || !mounted) return triggerButton;

  return (
    <>
      {triggerButton}
      {createPortal(modal(), document.body)}
    </>
  );

  function modal() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 font-display text-fg">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-line bg-canvas shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="text-[16px] font-bold">학생 Repo 일괄 생성 · {orgName}</h3>
            <p className="text-[11px] text-fg-3 mt-0.5">
              학생 명단(시크릿)대로 private repo를 만들고, 각 학생 1명만 push 권한 collaborator로 등록합니다.
              명단에 GitHub ID가 없으면 이전 과제 repo의 collaborator → 학생이 GitRepoTrack 로그인 때 확인된 GitHub 이메일 → 공개 이메일 검색 순으로 찾습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={running}
            aria-label="닫기"
            className="rounded-lg p-1 text-fg-3 hover:bg-chip hover:text-fg disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* 접두사 입력 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-2">
              과제 접두사
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={prefixInput}
                onChange={(e) => resetForNewPrefix(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter" && prefixInput.trim()) {
                    e.preventDefault();
                    loadPreview();
                  }
                }}
                placeholder="assign10"
                disabled={running}
                className="w-40 rounded-lg bg-chip px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <span className="inline-flex items-center gap-1 rounded-lg bg-chip px-2.5 py-2 text-xs font-mono text-fg-2">
                <Lock className="w-3 h-3" />
                -c01 (분반 고정)
              </span>
              <span className="text-xs font-mono text-fg-3">-학번</span>
              <button
                type="button"
                onClick={loadPreview}
                disabled={loadingPreview || running || !prefixInput.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-chip px-3 py-2 text-xs font-semibold text-fg-2 hover:text-fg disabled:opacity-50"
              >
                {loadingPreview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>미리보기</span>
              </button>
            </div>
            <p className="text-[11px] text-fg-3">
              예: <code>assign10</code> 입력 → <code>assign10-c01-22100063</code>
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {preview && !preview.rosterConfigured && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-800 dark:text-amber-200">
              {preview.error}
            </div>
          )}

          {/* 명단 출처: 로컬 파일과 환경변수 중 무엇을 읽었는지 */}
          {preview?.rosterConfigured && (
            <p className="text-[11px] text-fg-3">
              명단 출처:{" "}
              <strong>
                {preview.rosterSource === "file"
                  ? "secrets/roster.csv (로컬 파일)"
                  : "환경변수 ROSTER_CSV_BASE64"}
              </strong>{" "}
              · {students.length}명
            </p>
          )}

          {/* 연결될 과제 */}
          {preview?.rosterConfigured &&
            (preview.existingAssignment ? (
              <div className="flex items-start gap-2 rounded-lg bg-chip p-3 text-xs text-fg-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  기존 과제 <strong>&ldquo;{preview.existingAssignment.title}&rdquo;</strong>에 추가됩니다.
                  이미 있는 repo는 새로 만들지 않고 등록·권한만 확인합니다.
                </span>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-line p-3">
                <p className="text-xs font-semibold text-chart">
                  새 과제가 만들어집니다
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-fg-2">과제 제목</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={running || Boolean(assignmentId)}
                      className="w-full rounded-lg bg-chip px-3 py-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-semibold text-fg-2">마감 일시</span>
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      disabled={running || Boolean(assignmentId)}
                      className="w-full rounded-lg bg-chip px-3 py-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </label>
                </div>
              </div>
            ))}

          {preview?.githubWarning && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-800 dark:text-amber-200">
              GitHub 조회 경고: {preview.githubWarning}
            </div>
          )}

          {preview?.invalidRows && preview.invalidRows.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold">명단에서 제외된 줄 {preview.invalidRows.length}개</p>
              <ul className="list-disc pl-4">
                {preview.invalidRows.map((r) => (
                  <li key={r.line}>
                    {r.line}번째 줄: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canRun && (
            <>
              {preview?.templates && preview.templates.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <label className="font-semibold text-fg-2">
                    템플릿 repo (선택)
                  </label>
                  <select
                    value={templateRepo}
                    onChange={(e) => setTemplateRepo(e.target.value)}
                    disabled={running}
                    className="rounded-lg bg-chip px-2 py-1.5 text-xs text-fg"
                  >
                    <option value="">사용 안 함 (README만 생성)</option>
                    {preview.templates.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-lg border border-line overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-fg-3">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">학번</th>
                      <th className="px-3 py-2 text-left font-semibold">이름</th>
                      <th className="px-3 py-2 text-left font-semibold">GitHub ID</th>
                      <th className="px-3 py-2 text-left font-semibold">repo 이름</th>
                      <th className="px-3 py-2 text-left font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {students.map((s) => {
                      const r = results[s.studentNo];
                      return (
                        <tr key={s.studentNo}>
                          <td className="px-3 py-2 font-mono">{s.studentNo}</td>
                          <td className="px-3 py-2">{s.name || "-"}</td>
                          <td className="px-3 py-2">
                            <GithubLoginCell student={s} />
                          </td>
                          <td className="px-3 py-2 font-mono">{s.repoName}</td>
                          <td className="px-3 py-2">
                            {r ? (
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  r.ok ? "text-brand" : "text-danger"
                                }`}
                              >
                                {r.ok ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                )}
                                {resultLabel(r)}
                              </span>
                            ) : s.exists ? (
                              <span className="text-fg-3">이미 있음 (등록·권한만 확인)</span>
                            ) : (
                              <span className="text-chart">생성 예정</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {preview?.rosterConfigured && students.length === 0 && (
            <p className="text-xs text-fg-3">명단에 유효한 학생이 없습니다.</p>
          )}
        </div>

        {canRun && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
            <span className="text-xs text-fg-3">
              {running
                ? `진행 중... ${doneCount}/${students.length}`
                : doneCount > 0
                ? `완료 ${doneCount - failedNos.length}명 · 실패 ${failedNos.length}명`
                : `총 ${students.length}명`}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {!running && failedNos.length > 0 && (
                <button
                  type="button"
                  onClick={() => runProvision(failedNos)}
                  className="inline-flex items-center gap-1 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger hover:brightness-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>실패한 학생만 다시 시도</span>
                </button>
              )}
              {!running && assignmentId && doneCount > 0 ? (
                <Link
                  href={`/admin/assignments/${assignmentId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                >
                  <span>과제 관리로 이동</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => runProvision(students.map((s) => s.studentNo))}
                  disabled={running}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {running ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderPlus className="w-3.5 h-3.5" />
                  )}
                  <span>{running ? "생성 중..." : `${students.length}명 repo 생성 시작`}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
  }
}
