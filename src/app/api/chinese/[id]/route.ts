import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";

const Patch = z.object({ favorite: z.boolean() });

/** PATCH /api/chinese/[id] — 즐겨찾기 */
export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const { error } = await supabase.from("zh_phrases").update(parsed.data).eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});

/** DELETE /api/chinese/[id] — 문장과 모든 난이도 번역 삭제 */
export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("zh_phrases").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
