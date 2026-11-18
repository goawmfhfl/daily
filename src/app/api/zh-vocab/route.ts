import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { ZH_VOCAB_MAX_INPUT } from "@/lib/constants";
import { buildVocabCard } from "@/lib/ai/zh-vocab";
import { hasOpenAI } from "@/lib/openai";
import type { ZhVocabRow } from "@/lib/types";

/** GET /api/zh-vocab — 단어장 전체, 최신순 */
export const GET = handler(async () => {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("zh_vocab")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return fail(error.message, 500);
  return json({ items: (data ?? []) as ZhVocabRow[] });
});

const Body = z.object({
  text: z.string().trim().min(1).max(ZH_VOCAB_MAX_INPUT),
  /** 번역 카드에서 단어를 넣을 때 그 문장. 뜻을 문맥에 맞추는 데만 쓴다 */
  context: z.string().trim().max(500).nullable().optional(),
});

/**
 * POST /api/zh-vocab — 단어·숙어·문장을 넣으면 AI 가 병음·뜻·해석·예문을 만들어 저장.
 * 이미 있는 항목이면 AI 를 부르지 않고 기존 항목을 돌려준다 (duplicate: true).
 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail(`1~${ZH_VOCAB_MAX_INPUT}자로 입력하세요.`);
  const { text, context } = parsed.data;

  // 같은 한자나 같은 입력으로 이미 저장한 카드가 있으면 그대로
  const { data: existing } = await supabase
    .from("zh_vocab")
    .select("*")
    .or(`hanzi.eq.${JSON.stringify(text)},input.eq.${JSON.stringify(text)}`)
    .limit(1)
    .maybeSingle<ZhVocabRow>();
  if (existing) return json({ item: existing, duplicate: true });

  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);
  const card = await buildVocabCard(text, context);

  const { data: item, error } = await supabase
    .from("zh_vocab")
    .insert({ user_id: user.id, input: text, ...card })
    .select("*")
    .single<ZhVocabRow>();

  if (error?.code === "23505") {
    // 한국어로 입력했는데 결과 한자가 이미 단어장에 있는 경우
    const { data: dup } = await supabase
      .from("zh_vocab")
      .select("*")
      .eq("kind", card.kind)
      .eq("hanzi", card.hanzi)
      .maybeSingle<ZhVocabRow>();
    if (dup) return json({ item: dup, duplicate: true });
  }
  if (error || !item) return fail(error?.message ?? "저장 실패", 500);
  return json({ item, duplicate: false });
});
