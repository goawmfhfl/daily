import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

/** PUT /api/habits/order — 드래그로 바꾼 순서를 그대로 저장 */
export const PUT = handler(async (req) => {
  const { supabase } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const results = await Promise.all(
    parsed.data.ids.map((id, i) => supabase.from("habits").update({ sort_order: i }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error.message, 500);
  return json({ ok: true });
});
