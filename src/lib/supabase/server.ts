import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.",
    );
  }
  return { url, key };
}

/** 서버 컴포넌트 / 라우트 핸들러 / 서버 액션용 클라이언트 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, key } = env();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서 호출되면 쓰기 불가. proxy 가 세션을 갱신하므로 무시.
        }
      },
    },
  });
}

/** API용: 미로그인 시 null */
export async function getUserApi(): Promise<{
  supabase: SupabaseClient;
  user: User | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
