import { handler, requireUser, json, fail } from "@/lib/api-server";
import { buildPairs, splitZhUnits } from "@/lib/ai/zh-pairs";
import { hasOpenAI } from "@/lib/openai";
import type { ZhPair, ZhPhraseRow, ZhTranslationRow } from "@/lib/types";

/**
 * POST /api/zh-pairs/[id] — 번역(id)을 [한국어 ↔ 중국어 한 문장] 짝으로 나눈다.
 * 이미 나눠 둔 게 있으면 그대로 돌려주고, 없으면 한 번 계산해 저장한다.
 */
export const POST = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: t } = await supabase
    .from("zh_translations")
    .select("*, zh_phrases(*)")
    .eq("id", id)
    .maybeSingle<ZhTranslationRow & { zh_phrases: ZhPhraseRow }>();
  if (!t) return fail("번역을 찾을 수 없습니다.", 404);
  if (t.pairs) return json({ pairs: t.pairs });

  // 중국어가 여러 문장인데 AI 를 못 쓰면 저장하지 않고 문단 하나로만 보여 준다
  if (!hasOpenAI() && splitZhUnits(t.segments).length > 1) {
    return json({ pairs: [{ ko: t.zh_phrases.source_ko, from: 0, to: t.segments.length }] satisfies ZhPair[] });
  }

  const pairs = await buildPairs(t.zh_phrases.source_ko, t.segments);
  await supabase.from("zh_translations").update({ pairs }).eq("id", id);
  return json({ pairs });
});
