import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { buildHskSet } from "@/lib/ai/hsk";
import { HSK_LEVEL_SPEC, type HskLevel } from "@/lib/hsk";
import { hasOpenAI } from "@/lib/openai";
import type { HskSetRow } from "@/lib/types";

/** 출제 + 블라인드 검수 (+ 재시도) 에 1~3분 걸릴 수 있다 */
export const maxDuration = 300;

const Body = z.object({
  level: z.number().int().refine((n) => n in HSK_LEVEL_SPEC, "아직 열지 않은 급수입니다."),
  topic: z.string().max(20).nullable().optional(),
  /** 비슷한 문제: 정답으로 꼭 쓸 단어 */
  focus_words: z.array(z.string().max(12)).max(5).optional(),
  /** true 면 바로 풀 세트(꺼낸 것으로 표시), false 면 풀에 쌓기 */
  serve: z.boolean().default(false),
});

/** POST /api/hsk/generate — 세트를 새로 만든다 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다.");
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);
  const { level, topic, focus_words, serve } = parsed.data;

  // 최근 제목과 겹치지 않게
  const { data: recent } = await supabase
    .from("hsk_sets")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(12);

  const built = await buildHskSet({
    level: level as HskLevel,
    topic,
    focusWords: focus_words,
    avoidTitles: (recent ?? []).map((r) => r.title).filter(Boolean),
  });

  const { data: set, error } = await supabase
    .from("hsk_sets")
    .insert({
      user_id: user.id,
      ...built,
      origin: focus_words?.length ? "similar" : "pool",
      focus_words: focus_words ?? [],
      served_at: serve ? new Date().toISOString() : null,
    })
    .select("*")
    .single<HskSetRow>();
  if (error || !set) return fail(error?.message ?? "저장하지 못했습니다.", 500);
  return json({ set });
});
