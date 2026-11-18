import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import type { ZhPhraseRow, ZhTranslationRow, ZhVocabRow } from "@/lib/types";

const Body = z.object({ translation_id: z.string().uuid() });

/**
 * POST /api/zh-vocab/sentence — 번역 카드의 문장을 단어장에 저장.
 * 이미 번역·병음·분절·학습 포인트가 있으므로 AI 를 부르지 않고 옮겨 담는다.
 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");

  const { data: t } = await supabase
    .from("zh_translations")
    .select("*, zh_phrases(*)")
    .eq("id", parsed.data.translation_id)
    .maybeSingle<ZhTranslationRow & { zh_phrases: ZhPhraseRow }>();
  if (!t) return fail("번역을 찾을 수 없습니다.", 404);

  const row = {
    user_id: user.id,
    kind: "sentence" as const,
    input: t.zh_phrases.source_ko,
    hanzi: t.hanzi,
    pinyin: t.pinyin,
    meaning: t.zh_phrases.source_ko,
    explanation: t.note ?? "",
    segments: t.segments,
    source_translation_id: t.id,
    model: t.model,
  };
  // 같은 문장이 이미 있으면 최신 번역 정보로 덮어쓴다
  const { data: item, error } = await supabase
    .from("zh_vocab")
    .upsert(row, { onConflict: "user_id,kind,hanzi" })
    .select("*")
    .single<ZhVocabRow>();
  if (error || !item) return fail(error?.message ?? "저장 실패", 500);
  return json({ item });
});
