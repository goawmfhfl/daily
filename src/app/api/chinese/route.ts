import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { ZH_LEVELS, ZH_MAX_INPUT } from "@/lib/constants";
import { translateToChinese } from "@/lib/ai/chinese";
import { hasOpenAI } from "@/lib/openai";
import type { ZhPhraseRow, ZhPhraseWithTranslations, ZhTranslationRow } from "@/lib/types";

const SELECT = "*, zh_translations(*)";

/** GET /api/chinese — 번역한 문장 목록(난이도별 번역 포함), 최신순 */
export const GET = handler(async () => {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("zh_phrases")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return fail(error.message, 500);
  return json({ phrases: (data ?? []) as ZhPhraseWithTranslations[] });
});

const Body = z.object({
  source_ko: z.string().trim().min(1).max(ZH_MAX_INPUT),
  level: z.enum(ZH_LEVELS),
});

/** POST /api/chinese — 한국어 문장을 선택한 난이도로 번역하고 저장 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail(`문장을 1~${ZH_MAX_INPUT}자로 입력하세요.`);
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  // 번역이 실패하면 문장도 저장하지 않도록 AI 먼저
  const t = await translateToChinese(parsed.data.source_ko, parsed.data.level);

  const { data: phrase, error: pErr } = await supabase
    .from("zh_phrases")
    .insert({ user_id: user.id, source_ko: parsed.data.source_ko })
    .select("*")
    .single<ZhPhraseRow>();
  if (pErr || !phrase) return fail(pErr?.message ?? "저장 실패", 500);

  const { data: translation, error: tErr } = await supabase
    .from("zh_translations")
    .insert({ phrase_id: phrase.id, user_id: user.id, level: parsed.data.level, ...t })
    .select("*")
    .single<ZhTranslationRow>();
  if (tErr || !translation) {
    await supabase.from("zh_phrases").delete().eq("id", phrase.id);
    return fail(tErr?.message ?? "저장 실패", 500);
  }

  return json({ phrase: { ...phrase, zh_translations: [translation] } satisfies ZhPhraseWithTranslations });
});
