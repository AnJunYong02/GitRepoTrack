"use client";

import { useState } from "react";
import { AlertCircle, Github } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface GitHubLoginButtonProps {
  /** 로그인 콜백 실패로 돌아왔을 때 보여 줄 오류 (/?error=…) */
  initialError?: string | null;
}

/** 첫 화면 "GitHub로 시작하기": 누르면 중간 화면 없이 바로 GitHub 로그인(OAuth)으로 이동 */
export function GitHubLoginButton({ initialError = null }: GitHubLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError ?? "");

  const handleGitHubLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          scopes: "read:user user:email read:org", // read:org: org Owner 여부 자동 확인용
          queryParams: {
            prompt: "select_account", // GitHub 계정 선택(전환) 화면을 항상 보여 줌
          },
        },
      });
      if (error) throw error;
      // 성공하면 브라우저가 GitHub로 이동하므로 loading 상태를 그대로 둔다
    } catch (err: any) {
      setErrorMsg(err.message || "GitHub 로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <p role="alert" className="flex items-center gap-1.5 text-[14px] text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </p>
      )}
      <button
        type="button"
        onClick={handleGitHubLogin}
        disabled={loading}
        className="inline-flex items-center gap-2.5 rounded-xl bg-brand px-8 py-4 text-[16px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        <Github className="h-5 w-5" />
        {loading ? "GitHub로 이동 중..." : "GitHub로 시작하기"}
      </button>
    </div>
  );
}
