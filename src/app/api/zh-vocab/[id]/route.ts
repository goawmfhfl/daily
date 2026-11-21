import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { applyReview, REVIEW_ACTIONS } from "@/lib/zh-review";
import type { ZhVocabRow } from "@/lib/types";

const Review = z.object({
  action: z.enum(REVIEW_ACTIONS),
  /** 기기 기준 오늘 (다음 복습 날짜 계산용) */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** PATCH /api/zh-vocab/[id] — 암기 체크: 외웠어요 / 아직 / 처음부터 / 완전히 외움 */
export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const parsed = Review.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");

  const { data: cur } = await supabase.from("zh_vocab").select("*").eq("id", id).maybeSingle<ZhVocabRow>();
  if (!cur) return fail("단어를 찾을 수 없습니다.", 404);

  const next = applyReview(cur, parsed.data.action, parsed.data.today);
  const { data: item, error } = await supabase
    .from("zh_vocab")
    .update(next)
    .eq("id", id)
    .select("*")
    .single<ZhVocabRow>();
  if (error || !item) return fail(error?.message ?? "저장 실패", 500);
  return json({ item });
});

/** DELETE /api/zh-vocab/[id] — 단어장 항목 삭제 */
export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("zh_vocab").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
