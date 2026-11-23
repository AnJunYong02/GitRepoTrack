import { redirect } from "next/navigation";

/**
 * 예전 로그인 화면 주소. 이제 첫 화면의 "GitHub로 시작하기"가 바로 GitHub 로그인을 시작하므로
 * 이 주소는 첫 화면으로 보내기만 한다 (예전 /login 북마크·링크 호환용).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const error = (searchParams ? await searchParams : undefined)?.error;
  redirect(error ? `/?error=${encodeURIComponent(error)}` : "/");
}
