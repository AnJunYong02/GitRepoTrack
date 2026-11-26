"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  getSessionStorage,
  ORG_REPOS_UPDATED_EVENT,
  orgReposSessionKey,
  readSessionCache,
  writeSessionCache,
} from "@/lib/cache/session-cache";

/** org repo 조회 결과 중 이 버튼이 쓰는 부분 (과제 목록의 OrgReposCacheData와 같은 모양) */
interface OrgReposData {
  orgName: string;
  totalRepos: number;
  categories: unknown[];
}

interface RepoRefreshButtonProps {
  org: string;
  className: string;
  /** 사이드바가 접혔을 때 글자를 숨기는 클래스 */
  hideClassName?: string;
}

/**
 * 관리자 사이드바 "Repo 새로고침  394개".
 * GitHub에서 org repo 목록을 강제로 다시 읽어 세션 캐시에 저장하고, 과제 목록 화면에 결과를 이벤트로 전달한다.
 */
export function RepoRefreshButton({ org, className, hideClassName = "" }: RepoRefreshButtonProps) {
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 개수: 처음엔 세션 캐시에서, 이후엔 누가 새로 받아 오든 이벤트로 갱신
  useEffect(() => {
    const cached = readSessionCache<OrgReposData>(getSessionStorage(), orgReposSessionKey(org));
    if (cached) setTotal(cached.data.totalRepos ?? null);

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ orgName?: string; data?: OrgReposData }>).detail;
      if ((detail?.orgName || "").toLowerCase() === org.toLowerCase() && detail?.data) {
        setTotal(detail.data.totalRepos ?? null);
      }
    };
    window.addEventListener(ORG_REPOS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(ORG_REPOS_UPDATED_EVENT, onUpdated);
  }, [org]);

  // 새로고침 중 경과 시간
  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [loading]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/org-repos?org=${encodeURIComponent(org)}&refresh=1`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Repo 목록을 새로 불러오지 못했습니다.");
      const data: OrgReposData = {
        orgName: json.orgName || org,
        totalRepos: json.totalRepos || 0,
        categories: json.categories || [],
      };
      writeSessionCache(getSessionStorage(), orgReposSessionKey(org), data);
      setTotal(data.totalRepos);
      window.dispatchEvent(new CustomEvent(ORG_REPOS_UPDATED_EVENT, { detail: { orgName: org, data } }));
    } catch (err: any) {
      setError(err.message || "Repo 목록을 새로 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        title={`${org} Organization의 저장소 목록을 GitHub에서 다시 불러오기`}
        className={className}
      >
        <RefreshCw className={`h-[18px] w-[18px] shrink-0 ${loading ? "animate-spin text-brand" : ""}`} />
        <span className={`flex flex-1 items-center justify-between gap-2 whitespace-nowrap ${hideClassName}`}>
          <span>{loading ? `동기화 중 (${(elapsedMs / 1000).toFixed(1)}초)` : "Repo 새로고침"}</span>
          {!loading && total !== null && <span className="text-[12px] tabular-nums text-fg-3">{total}개</span>}
        </span>
      </button>
      {error && (
        <p role="status" className={`px-3 text-[11px] text-danger ${hideClassName}`}>
          {error}
        </p>
      )}
    </>
  );
}
