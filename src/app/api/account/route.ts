import { handler, requireUser, json, fail } from "@/lib/api-server";

/**
 * DELETE /api/account — 내 기록 데이터 전체 삭제.
 * entries 삭제 시 태그·임베딩·근거는 cascade. reports, habits 는 별도 삭제.
 * 인증 계정 자체 삭제는 service role 이 필요하므로 여기서 하지 않는다.
 */
export const DELETE = handler(async () => {
  const { supabase, user } = await requireUser();
  const steps = [
    supabase.from("reports").delete().eq("user_id", user.id),
    supabase.from("entries").delete().eq("user_id", user.id),
    supabase.from("habits").delete().eq("user_id", user.id),
    supabase.from("experiences").delete().eq("user_id", user.id),
  ];
  for (const s of steps) {
    const { error } = await s;
    if (error) return fail(error.message, 500);
  }
  return json({ ok: true });
});
