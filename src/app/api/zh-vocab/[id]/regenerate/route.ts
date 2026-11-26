import { handler, requireUser, json, fail } from "@/lib/api-server";
import { buildVocabCard } from "@/lib/ai/zh-vocab";
import { hasOpenAI } from "@/lib/openai";
import type { ZhVocabRow } from "@/lib/types";

/** 한국어 확인 후 재시도까지 하면 길게는 수십 초 */
export const maxDuration = 120;

/**
 * POST /api/zh-vocab/[id]/regenerate — 카드 내용을 AI로 다시 만든다.
 * 표현(한자)·종류·암기 상태는 그대로 두고 병음·품사·뜻·해석·예문만 바꾼다.
 */
export const POST = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  const { data: cur } = await supabase.from("zh_vocab").select("*").eq("id", id).maybeSingle<ZhVocabRow>();
  if (!cur) return fail("카드를 찾을 수 없습니다.", 404);
  if (cur.source_translation_id) return fail("번역에서 저장한 문장은 번역 카드에서 다시 번역해 주세요.");

  const card = await buildVocabCard(cur.hanzi);
  const { data: item, error } = await supabase
    .from("zh_vocab")
    .update({
      pinyin: card.pinyin,
      part_of_speech: cur.kind === "sentence" ? "" : card.part_of_speech,
      meaning: card.meaning,
      explanation: card.explanation,
      examples: card.examples,
      model: card.model,
    })
    .eq("id", id)
    .select("*")
    .single<ZhVocabRow>();
  if (error || !item) return fail(error?.message ?? "저장 실패", 500);
  return json({ item });
});
