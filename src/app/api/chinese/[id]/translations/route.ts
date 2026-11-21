import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { ZH_LEVELS } from "@/lib/constants";
import { translateToChinese } from "@/lib/ai/chinese";
import { hasOpenAI } from "@/lib/openai";
import type { ZhPhraseRow, ZhTranslationRow } from "@/lib/types";

const Body = z.object({ level: z.enum(ZH_LEVELS) });

/**
 * POST /api/chinese/[id]/translations — 같은 문장을 다른 난이도로도 번역.
 * 이미 그 난이도 번역이 있으면 새로 만들어 덮어쓴다 (다시 번역).
 */
export const POST = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("난이도가 올바르지 않습니다.");
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  const { data: phrase } = await supabase
    .from("zh_phrases")
    .select("*")
    .eq("id", id)
    .maybeSingle<ZhPhraseRow>();
  if (!phrase) return fail("문장을 찾을 수 없습니다.", 404);

  const t = await translateToChinese(phrase.source_ko, parsed.data.level);
  const { data: translation, error } = await supabase
    .from("zh_translations")
    .upsert(
      { phrase_id: id, user_id: user.id, level: parsed.data.level, ...t, pairs: null, created_at: new Date().toISOString() },
      { onConflict: "phrase_id,level" },
    )
    .select("*")
    .single<ZhTranslationRow>();
  if (error || !translation) return fail(error?.message ?? "저장 실패", 500);
  return json({ translation });
});
