import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { embed, hasOpenAI } from "@/lib/openai";
import { fetchEntries } from "@/lib/data";

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
    match_count: 30,
  });
  if (error) return fail(error.message, 500);
  const rows = (data ?? []) as { entry_id: string; similarity: number }[];
  const ids = rows.map((r) => r.entry_id);
  if (!ids.length) return json({ entries: [] });

  const entries = await fetchEntries(supabase, { ids });
  const order = new Map(ids.map((id, i) => [id, i]));
  entries.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return json({
    entries: entries.map((e) => ({
      ...e,
      similarity: rows.find((r) => r.entry_id === e.id)?.similarity ?? 0,
    })),
  });
});
