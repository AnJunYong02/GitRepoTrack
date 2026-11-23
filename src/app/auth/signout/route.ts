import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 로그아웃 후 첫 화면으로 (303: POST 요청 뒤 GET으로 이동)
  return NextResponse.redirect(new URL("/", req.url), 303);
}
