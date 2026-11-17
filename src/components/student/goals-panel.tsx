/**
 * 학생 대시보드 오른쪽 "Goals" 패널.
 * 아직 내용·기능이 없는 자리 표시용이며, 이후 사용자가 직접 채울 예정이다.
 */
export function GoalsPanel() {
  return (
    <section
      aria-label="Goals"
      className="neu-hover flex h-full min-h-[22rem] flex-col rounded-[28px] bg-surface p-6 shadow-neu"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">Goals</h2>
      </div>
      {/* 비워 둔 영역 */}
      <div className="mt-6 flex-1 rounded-3xl shadow-neu-inset" />
    </section>
  );
}
