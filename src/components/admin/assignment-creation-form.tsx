"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Loader2,
  FolderOpen,
  FilePlus2,
  RefreshCw,
} from "lucide-react";
import {
  buildStudentRepoFromConvention,
  MAX_INITIAL_FILES,
  MAX_INITIAL_FILE_BYTES,
  normalizeClassCode,
  parseKeywords,
  validateCreationSettings,
  validateCreationStudent,
  validateInitialFilePath,
  type AssignmentPreset,
  type CreationSettings,
  type InitialFile,
} from "@/lib/assignments/creation";
import {
  isoToKstLocalInput,
  kstLocalInputToIso,
} from "@/lib/admin/deadline-input";
import { KeywordTransfer } from "./keyword-transfer";
import type { CreationResult } from "@/lib/github/create-assignment-repo";

interface StudentRow {
  studentNo: string;
  name: string;
  githubLogin: string | null;
}
interface Props {
  org: string;
  initialStudents: StudentRow[];
  presets: AssignmentPreset[];
}
const INPUT =
  "w-full rounded-xl bg-chip px-4 py-3 text-[14px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30";
const BUTTON =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-chip px-4 py-2.5 text-[13px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50";
const PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-3 text-[14px] font-bold text-white hover:brightness-110 disabled:opacity-50";

async function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () =>
      reject(new Error("파일을 읽지 못했습니다. 다시 선택하세요."));
    reader.readAsDataURL(file);
  });
}

export function AssignmentCreationForm({
  org,
  initialStudents,
  presets,
}: Props) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initialStudents
          .filter((student) => student.githubLogin && student.name)
          .map((student) => student.studentNo),
      ),
  );
  const [repoBase, setRepoBase] = useState("");
  const [title, setTitle] = useState("");
  const [classInput, setClassInput] = useState("1");
  const [deadline, setDeadline] = useState(
    () =>
      isoToKstLocalInput(
        new Date(Date.now() + 7 * 86400000).toISOString(),
      ).slice(0, 10) + "T23:59",
  );
  const [keywords, setKeywords] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [minCommits, setMinCommits] = useState(0);
  const [readmeRequired, setReadmeRequired] = useState(true);
  const [customConvention, setCustomConvention] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [newStudent, setNewStudent] = useState({
    studentNo: "",
    name: "",
    githubLogin: "",
  });
  const [addingStudent, setAddingStudent] = useState(false);
  const [refreshingRoster, setRefreshingRoster] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadedPreset, setLoadedPreset] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CreationResult>>({});
  const requestId = useRef<string | null>(null);
  const planRef = useRef<{
    settings: CreationSettings;
    students: { studentNo: string; repoName: string }[];
    files: InitialFile[];
  } | null>(null);
  const inFlight = useRef(false);
  const locked = running || Boolean(planRef.current);
  const classCode = normalizeClassCode(classInput);
  const targets = students.filter((student) => selected.has(student.studentNo));
  const repoConvention =
    customConvention ?? `${org}-${repoBase.trim()}-${classCode ?? "c01"}`;
  const repoName = (student: StudentRow) =>
    buildStudentRepoFromConvention(repoConvention, student.githubLogin ?? "");
  const failed = Object.values(results).filter((result) => !result.ok);
  const complete =
    Boolean(assignmentId) &&
    targets.length > 0 &&
    targets.every((student) => results[student.studentNo]?.ok);

  const applyPreset = (preset: AssignmentPreset) => {
    setRepoBase(preset.repoBase);
    setTitle(preset.title);
    setClassInput(preset.classCode);
    setDeadline(isoToKstLocalInput(preset.deadlineAt));
    setKeywords(preset.keywords);
    setWordInput("");
    setMinCommits(preset.minCommits);
    setReadmeRequired(preset.readmeRequired);
    setCustomConvention(preset.repoConvention ?? null);
    if (preset.studentNos)
      setSelected(
        new Set(
          students
            .filter((student) => preset.studentNos!.includes(student.studentNo))
            .map((student) => student.studentNo),
        ),
      );
    setLoadedPreset(preset.title);
    setShowHistory(false);
    setError("");
  };

  const refreshRoster = async () => {
    setRefreshingRoster(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/students?org=${encodeURIComponent(org)}`,
      );
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.students))
        throw new Error(data.error || "명단을 불러오지 못했습니다.");
      const updated: StudentRow[] = data.students;
      const previousNos = new Set(students.map((student) => student.studentNo));
      setSelected(
        (current) =>
          new Set(
            updated
              .filter(
                (student) =>
                  current.has(student.studentNo) ||
                  (!previousNos.has(student.studentNo) &&
                    student.name &&
                    student.githubLogin),
              )
              .map((student) => student.studentNo),
          ),
      );
      setStudents(updated);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setRefreshingRoster(false);
    }
  };

  useEffect(() => {
    if (complete || (!running && !planRef.current)) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [running, assignmentId, complete]);

  const addStudent = async () => {
    setError("");
    setAddingStudent(true);
    try {
      const student = validateCreationStudent(newStudent);
      const response = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, student }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "학생을 추가하지 못했습니다.");
      setStudents((current) => [...current, data.student]);
      setSelected((current) => new Set([...current, data.student.studentNo]));
      setNewStudent({ studentNo: "", name: "", githubLogin: "" });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setAddingStudent(false);
    }
  };

  const selectFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setError("");
    try {
      const byPath = new Map(
        files.map((file) => [file.webkitRelativePath || file.name, file]),
      );
      for (const file of Array.from(incoming)) {
        const path = file.webkitRelativePath || file.name;
        validateInitialFilePath(path);
        byPath.set(path, file);
      }
      const next = [...byPath.values()];
      if (
        next.length > MAX_INITIAL_FILES ||
        next.reduce((size, file) => size + file.size, 0) >
          MAX_INITIAL_FILE_BYTES
      )
        throw new Error("초기 파일은 총 2 MB, 100개까지 선택할 수 있습니다.");
      setFiles(next);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const create = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setError("");
    try {
      if (!planRef.current) {
        const deadlineAt = kstLocalInputToIso(deadline);
        const settings = validateCreationSettings({
          repoBase,
          repoConvention,
          title,
          classCode: classInput,
          deadlineAt,
          keywords: [...new Set([...keywords, ...parseKeywords(wordInput)])],
          minCommits,
          readmeRequired,
        });
        if (!targets.length) throw new Error("생성할 학생을 선택하세요.");
        const seenNames = new Set<string>();
        const seenLogins = new Set<string>();
        for (const student of targets) {
          validateCreationStudent(student);
          const name = repoName(student).trim();
          if (
            !/^[a-zA-Z0-9._-]{1,100}$/.test(name) ||
            [".", ".."].includes(name)
          )
            throw new Error(
              "공통 레포 이름과 GitHub 아이디를 합쳐 100자 이내로 입력하세요.",
            );
          if (
            seenNames.has(name.toLowerCase()) ||
            seenLogins.has(student.githubLogin!.toLowerCase())
          )
            throw new Error("저장소 이름 또는 GitHub 아이디가 중복되었습니다.");
          seenNames.add(name.toLowerCase());
          seenLogins.add(student.githubLogin!.toLowerCase());
        }
        const initialFiles = await Promise.all(
          files.map(async (file) => ({
            path: file.webkitRelativePath || file.name,
            content: await fileAsBase64(file),
          })),
        );
        requestId.current ??= crypto.randomUUID();
        planRef.current = {
          settings,
          students: targets.map((student) => ({
            studentNo: student.studentNo,
            repoName: repoName(student).trim(),
          })),
          files: initialFiles,
        };
      }
      const plan = planRef.current;
      let id = assignmentId;
      if (!id) {
        const response = await fetch(
          `/api/admin/repo-provisioning?org=${encodeURIComponent(org)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: requestId.current, ...plan }),
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "과제를 준비하지 못했습니다.");
        id = data.assignmentId as string;
        setAssignmentId(id);
      }
      for (const student of plan.students) {
        if (results[student.studentNo]?.ok) continue;
        try {
          const response = await fetch(
            `/api/admin/assignments/${id}/create-repos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentNo: student.studentNo,
                files: plan.files,
              }),
            },
          );
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "저장소 생성에 실패했습니다.");
          setResults((current) => ({
            ...current,
            [student.studentNo]: data.result,
          }));
        } catch (error) {
          setResults((current) => ({
            ...current,
            [student.studentNo]: {
              studentNo: student.studentNo,
              repoName: student.repoName,
              ok: false,
              error: (error as Error).message,
            },
          }));
          throw error;
        }
      }
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setRunning(false);
      inFlight.current = false;
    }
  };

  return (
    <div className="space-y-10 pb-12">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger whitespace-pre-line"
        >
          {error}
        </p>
      )}
      <fieldset
        disabled={locked || addingStudent || refreshingRoster}
        className="space-y-10 disabled:opacity-75"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!presets.length}
            className={BUTTON}
            onClick={() => applyPreset(presets[0])}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            직전 과제 설정값 불러오기
          </button>
          <button
            type="button"
            disabled={!presets.length}
            className={BUTTON}
            onClick={() => setShowHistory(true)}
          >
            이전 과제 설정값 불러오기
          </button>
          {loadedPreset && (
            <span role="status" className="text-[12px] text-fg-3">
              {loadedPreset} 설정을 불러왔습니다.
            </span>
          )}
        </div>
        <p className="text-[12px] text-fg-3">
          이전 과제의 이름·분반·마감·검사 기준·대상 학생을 불러옵니다. 초기
          파일은 직접 선택하세요.
        </p>
        <section className="grid gap-6 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[15px] font-bold text-fg">
              GitHub 레포 이름
            </span>
            <input
              required
              value={repoBase}
              maxLength={100}
              onChange={(event) => {
                setRepoBase(event.target.value);
                setCustomConvention(null);
              }}
              placeholder="예: assignment01"
              className={INPUT}
            />
          </label>
          <label className="space-y-2">
            <span className="text-[15px] font-bold text-fg">
              서비스 과제 이름
            </span>
            <input
              required
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 1주차 웹 서비스 실습"
              className={INPUT}
            />
          </label>
          <label className="space-y-2">
            <span className="text-[15px] font-bold text-fg">분반</span>
            <input
              value={classInput}
              onChange={(event) => {
                setClassInput(event.target.value);
                setCustomConvention(null);
              }}
              placeholder="예: 1 또는 c01"
              className={INPUT}
            />
            <span className="text-[12px] text-fg-3">
              레포 이름에 {classCode ?? "c01"}로 표시됩니다.
            </span>
          </label>
          <label className="space-y-2">
            <span className="text-[15px] font-bold text-fg">
              과제 마감 기한 (한국 시간)
            </span>
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className={INPUT}
            />
          </label>
        </section>

        <section className="space-y-4 border-t border-line pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[22px] font-bold text-fg">
              생성할 학생{" "}
              <span className="text-[14px] text-fg-3">{targets.length}명</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={BUTTON} onClick={refreshRoster}>
                <RefreshCw className="h-3.5 w-3.5" />
                명단 새로고침
              </button>
              <Link
                href={`/admin/students?org=${encodeURIComponent(org)}`}
                target="_blank"
                className="text-[13px] text-fg-3 hover:text-brand"
              >
                과목 학생 관리 ↗
              </Link>
            </div>
          </div>
          <p className="text-[12px] text-fg-3">
            제외하면 이번 과제의 생성 대상에서 빠집니다. 새 학생은 과목 명단에도
            저장됩니다.
          </p>
          {students.length === 0 ? (
            <p className="py-4 text-[14px] text-fg-3">
              등록된 학생이 없습니다. CSV를 등록하거나 아래에서 추가하세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-y border-line text-fg-3">
                  <tr>
                    <th className="py-3 pr-3">
                      <input
                        type="checkbox"
                        aria-label="전체 학생 선택"
                        checked={
                          students.length > 0 &&
                          selected.size === students.length
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? new Set(
                                  students.map((student) => student.studentNo),
                                )
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <th className="px-2 py-3">이름</th>
                    <th className="px-2 py-3">학번</th>
                    <th className="px-2 py-3">GitHub 아이디</th>
                    <th className="px-2 py-3">대상</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map((student) => (
                    <tr key={student.studentNo} className="text-fg-2">
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`${student.name || student.studentNo} 생성 대상`}
                          checked={selected.has(student.studentNo)}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked)
                                next.add(student.studentNo);
                              else next.delete(student.studentNo);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-3">
                        {student.name || "이름 미등록"}
                      </td>
                      <td className="px-2 py-3 font-mono">
                        {student.studentNo}
                      </td>
                      <td className="px-2 py-3">
                        {student.githubLogin || "학생 관리에서 ID 등록 필요"}
                      </td>
                      <td className="px-2 py-3">
                        {selected.has(student.studentNo) ? "포함" : "제외"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid items-end gap-3 rounded-xl bg-chip/40 p-4 sm:grid-cols-4">
            {(
              [
                ["name", "이름"],
                ["studentNo", "학번"],
                ["githubLogin", "GitHub 아이디"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-[12px] font-semibold text-fg-2">
                  {label}
                </span>
                <input
                  value={newStudent[key]}
                  onChange={(event) =>
                    setNewStudent((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className={INPUT}
                />
              </label>
            ))}
            <button type="button" onClick={addStudent} className={BUTTON}>
              <Plus className="h-4 w-4" />
              {addingStudent ? "저장 중…" : "학생 추가"}
            </button>
          </div>
        </section>

        <section className="space-y-4 border-t border-line pt-7">
          <h2 className="text-[22px] font-bold text-fg">초기 파일</h2>
          <p className="text-[12px] text-fg-3">
            레포 생성 후 main 브랜치에 커밋합니다. 총 2 MB, 100개까지 선택할 수
            있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className={`${BUTTON} cursor-pointer`}>
              <FilePlus2 className="h-4 w-4" />
              파일 선택
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  selectFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <label className={`${BUTTON} cursor-pointer`}>
              <FolderOpen className="h-4 w-4" />
              폴더 선택
              <input
                type="file"
                multiple
                {...{ webkitdirectory: "", directory: "" }}
                className="sr-only"
                onChange={(event) => {
                  selectFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <button
                type="button"
                className={BUTTON}
                onClick={() => setFiles([])}
              >
                선택 지우기
              </button>
            )}
          </div>
          {files.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-[12px] text-fg-2">
              {files.map((file, index) => (
                <li
                  key={file.webkitRelativePath || file.name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="break-all">
                    {file.webkitRelativePath || file.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`${file.name} 제외`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 border-t border-line pt-7">
          <h2 className="text-[22px] font-bold text-fg">README 검사 단어</h2>
          <KeywordTransfer keywords={keywords} onChange={setKeywords} />
          <div className="flex min-h-10 flex-wrap gap-2">
            {keywords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-[13px] text-brand"
              >
                {word}
                <button
                  type="button"
                  aria-label={`${word} 삭제`}
                  onClick={() =>
                    setKeywords((current) =>
                      current.filter((value) => value !== word),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={wordInput}
              onChange={(event) => setWordInput(event.target.value)}
              placeholder="단어를 쉼표 또는 줄바꿈으로 구분하세요."
              aria-label="README 검사 단어 입력"
              className={INPUT}
            />
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                setKeywords((current) => [
                  ...new Set([...current, ...parseKeywords(wordInput)]),
                ]);
                setWordInput("");
              }}
            >
              추가
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[13px] text-fg-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={readmeRequired}
                onChange={(event) => setReadmeRequired(event.target.checked)}
              />
              README 필수
            </label>
            <label className="flex items-center gap-2">
              최소 커밋 수
              <input
                type="number"
                min={0}
                value={minCommits}
                onChange={(event) => setMinCommits(Number(event.target.value))}
                className="w-24 rounded-xl bg-chip px-3 py-2 text-fg"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 border-t border-line pt-7">
          <h2 className="text-[22px] font-bold text-fg">
            GitHub 레포 이름 미리보기
          </h2>
          <label className="block space-y-2">
            <span className="text-[12px] text-fg-3">
              공통 이름 규칙 · 수정하면 모든 레포에 반영됩니다.
            </span>
            <input
              aria-label="공통 레포 이름 규칙"
              value={repoConvention}
              maxLength={100}
              className={`${INPUT} font-mono`}
              onChange={(event) => setCustomConvention(event.target.value)}
            />
          </label>
          <p className="text-[12px] text-fg-3">
            각 레포 끝에 학생별 GitHub 아이디가 자동으로 붙습니다.
          </p>
        </section>
      </fieldset>

      <section className="space-y-4 border-t border-line pt-7">
        <p className="text-[13px] text-fg-3">
          {org} 소유의 비공개 레포 {targets.length}개를 만들고 각 학생을
          collaborator로 초대합니다.
        </p>
        {Object.values(results).length > 0 && (
          <ul className="space-y-2 text-[13px]">
            {Object.values(results).map((result) => (
              <li
                key={result.studentNo}
                className={result.ok ? "text-brand" : "text-danger"}
              >
                {result.studentNo} ·{" "}
                {result.ok ? "생성·초대 완료" : result.error}
                {result.fullName && (
                  <a
                    className="ml-2 underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://github.com/${result.fullName}`}
                  >
                    {result.repoName} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          {!complete && (
            <button
              type="button"
              className={PRIMARY}
              disabled={
                running ||
                addingStudent ||
                refreshingRoster ||
                targets.length === 0
              }
              onClick={create}
            >
              {running && <Loader2 className="h-4 w-4 animate-spin" />}
              {running
                ? `생성 중… ${Object.values(results).filter((result) => result.ok).length}/${targets.length}`
                : locked
                  ? "미완료 학생 다시 시도"
                  : "과제 생성"}
            </button>
          )}
          {assignmentId && (
            <Link
              href={`/admin/assignments/${assignmentId}`}
              className={BUTTON}
            >
              과제 확인
            </Link>
          )}
          {planRef.current && !assignmentId && !running && (
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                planRef.current = null;
                requestId.current = null;
                setResults({});
                setError("");
                setRunning(false);
              }}
            >
              입력 수정
            </button>
          )}
          {failed.length > 0 && (
            <span className="self-center text-[12px] text-danger">
              실패 {failed.length}명
            </span>
          )}
        </div>
      </section>

      {showHistory &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
            onClick={(event) => {
              if (event.target === event.currentTarget) setShowHistory(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowHistory(false);
              }}
              aria-labelledby="preset-title"
              className="w-full max-w-lg rounded-2xl border border-line bg-canvas p-6 shadow-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 id="preset-title" className="text-[20px] font-bold text-fg">
                  이전 과제 선택
                </h2>
                <button
                  type="button"
                  aria-label="닫기"
                  autoFocus
                  onClick={() => setShowHistory(false)}
                >
                  <X className="h-5 w-5 text-fg-3" />
                </button>
              </div>
              <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className="w-full space-y-1 py-4 text-left hover:text-brand"
                      onClick={() => applyPreset(preset)}
                    >
                      <span className="block text-[15px] font-bold text-fg">
                        {preset.title}
                      </span>
                      <span className="text-[12px] text-fg-3">
                        {preset.classCode} · {preset.keywords.length}개 검사
                        단어
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
