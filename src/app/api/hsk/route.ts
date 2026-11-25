import { handler, requireUser, json, fail } from "@/lib/api-server";
import type { HskAttemptWithSet, HskSummary, HskWrongWithSet } from "@/lib/types";

/**
 * GET /api/hsk — 독해 탭 첫 화면에 필요한 것 한 번에:
 * 풀에 남은 세트 수, 누적 정답률, 오답노트(해결 안 된 것), 최근 푼 세트.
 */
export const GET = handler(async (req) => {
  const level = Number(new URL(req.url).searchParams.get("level") ?? 6);
  const { supabase } = await requireUser();

  const [pool, firsts, wrong, recent] = await Promise.all([
    supabase.from("hsk_sets").select("part").eq("level", level).eq("status", "active").is("served_at", null),
    supabase.from("hsk_attempts").select("correct, total").eq("mode", "first"),
    supabase
      .from("hsk_wrong")
      .select("*, hsk_sets!inner(*)")
      .is("resolved_at", null)
      .eq("hsk_sets.status", "active")
      .order("due_on", { ascending: true }),
    supabase
      .from("hsk_attempts")
      .select("*, hsk_sets!inner(*)")
      .eq("mode", "first")
      .eq("hsk_sets.status", "active")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const err = [pool.error, firsts.error, wrong.error, recent.error].find(Boolean);
  if (err) return fail(err.message, 500);

  const rows = firsts.data ?? [];
  return json<HskSummary>({
    pools: (pool.data ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.part] = (acc[r.part] ?? 0) + 1;
      return acc;
    }, {}),
    stats: {
      sets: rows.length,
      correct: rows.reduce((a, r) => a + r.correct, 0),
      total: rows.reduce((a, r) => a + r.total, 0),
    },
    wrong: (wrong.data ?? []) as HskWrongWithSet[],
    recent: (recent.data ?? []) as HskAttemptWithSet[],
  });
});
