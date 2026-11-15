import { NextResponse } from "next/server";
import { getUserApi } from "@/lib/supabase/server";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** 로그인 사용자 보장. 미로그인 시 401 응답을 던진다. */
export async function requireUser() {
  const { supabase, user } = await getUserApi();
  if (!user) throw fail("로그인이 필요합니다.", 401);
  return { supabase, user };
}

/** try/catch 를 공통으로. 던져진 NextResponse 는 그대로 반환 */
export function handler(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof NextResponse || e instanceof Response) return e;
      console.error(e);
      const message = e instanceof Error ? e.message : "알 수 없는 오류";
      return fail(message, 500);
    }
  };
}
