/** 학생 화면 로딩 스켈레톤 (64px 아이콘 줄 사이드바 + 본문 플랫 레이아웃) */
export default function DashboardLoading() {
  const bar = "animate-pulse rounded-lg bg-chip";
  return (
    <div className="min-h-screen bg-canvas font-display lg:pl-16" aria-busy="true" aria-label="불러오는 중">
      <aside className="flex gap-3 border-b border-line px-4 py-5 lg:fixed lg:inset-y-0 lg:left-0 lg:w-16 lg:flex-col lg:items-center lg:border-b-0 lg:border-r lg:px-0 lg:py-7">
        <div className="h-2.5 w-2.5 rounded-full bg-chip" />
        <div className="hidden h-12 lg:block" />
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${bar} h-8 w-8`} />
        ))}
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-[72px] lg:py-12">
        <div className="mx-auto max-w-[1240px] space-y-16">
          <div className={`${bar} h-12 w-80`} />
          <div className="grid gap-10 xl:grid-cols-[1fr_500px]">
            <div className="space-y-4">
              <div className={`${bar} h-10 w-72`} />
              <div className={`${bar} h-10 w-96`} />
            </div>
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`${bar} h-10 w-full`} />
              ))}
            </div>
          </div>
          <div className={`${bar} h-32 w-full`} />
        </div>
      </main>
    </div>
  );
}
