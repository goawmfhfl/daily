import { handler, requireUser, json, fail } from "@/lib/api-server";
import { fetchHabits } from "@/lib/data";
import { streakBefore } from "@/lib/habit-streak";

/**
 * GET /api/habits/streaks?today=yyyy-MM-dd — 활동별로 어제까지 이어 온 연속 일수.
 * 30일 체크 창보다 긴 연속도 셀 수 있게 서버에서 전체 체크로 계산한다.
 */
export const GET = handler(async (req) => {
  const today = new URL(req.url).searchParams.get("today") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return fail("today 가 필요합니다.");
  const { supabase } = await requireUser();
  const habits = await fetchHabits(supabase, true);
  const { data, error } = await supabase
    .from("habit_checks")
    .select("habit_id, entry_date")
    .eq("done", true)
    .lt("entry_date", today);
  if (error) return fail(error.message, 500);

  const byHabit = new Map<string, Set<string>>();
  for (const c of data ?? []) {
    (byHabit.get(c.habit_id) ?? byHabit.set(c.habit_id, new Set()).get(c.habit_id)!).add(c.entry_date);
  }
  const streaks: Record<string, number> = {};
  for (const h of habits) streaks[h.id] = streakBefore(h, byHabit.get(h.id) ?? new Set(), today);
  return json({ streaks });
});
