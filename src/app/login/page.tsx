"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GitBranch, Github, AlertCircle, Info } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGitHubLogin = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${origin}/auth/callback?next=/dashboard`,
          scopes: "read:user user:email read:org", // read:org allows automatic Org Owner detection
          queryParams: {
            prompt: "select_account", // Force GitHub to show the account picker / switch account screen
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || "GitHub 로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
          <GitBranch className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">GitRepoTrack 로그인</h1>
          <p className="text-xs text-slate-500">
            GitHub 계정으로 로그인하여 본인 과제 분석 및 현황을 확인하세요.
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          onClick={handleGitHubLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 py-3 text-sm font-semibold text-white dark:text-slate-900 shadow hover:bg-slate-800 dark:hover:bg-slate-200 transition disabled:opacity-50"
        >
          <Github className="w-5 h-5" />
          <span>{loading ? "GitHub로 이동 중..." : "GitHub 계정으로 계속하기"}</span>
        </button>

        {/* Student OAuth Notice Box */}
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-3.5 text-left text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 shrink-0" />
            <span>학생 로그인 시 GitHub 승인 화면 안내</span>
          </div>
          <p className="text-[11px] leading-relaxed text-blue-800/90 dark:text-blue-300/90">
            GitHub 로그인 시 나타나는 <strong>&quot;Authorize AnJunYong02&quot;</strong> 버튼은
              <br/>관리자 계정으로 로그인되는 것이 아니라, <strong>수업 관리자가 생성한 RepoTrack 앱에 본인의 GitHub 계정 연결을 허락(Authorize)</strong>하는 정상적인 절차입니다.<br/>
              안심하고 초록색 승인 버튼을 눌러 진행해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
