import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { embed, hasOpenAI } from "@/lib/openai";

const Body = z.object({ q: z.string().trim().min(1).max(200) });

/** POST /api/search — 의미 기반 검색 ("불안했던 날") */
export const POST = handler(async (req) => {
  const { supabase } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("검색어를 입력하세요.");
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  const vector = await embed(parsed.data.q);
  if (!vector) return fail("임베딩 생성 실패", 500);

  const { data, error } = await supabase.rpc("match_entries", {
    query_embedding: vector,
    match_count: 40,
  });
  if (error) return fail(error.message, 500);
  // 본문은 클라이언트 캐시에 이미 있으므로 순서와 유사도만 돌려준다
  const results = ((data ?? []) as { entry_id: string; similarity: number }[]).map(
    ({ entry_id, similarity }) => ({ entry_id, similarity }),
  );
  return json({ results });
});
