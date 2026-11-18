import { handler, requireUser, json, fail } from "@/lib/api-server";

/** DELETE /api/zh-vocab/[id] — 단어장 항목 삭제 */
export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("zh_vocab").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
