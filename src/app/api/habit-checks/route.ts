import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { fetchHabitChecks } from "@/lib/data";

const Body = z.object({
  habit_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
});

const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** GET /api/habit-checks?from=yyyy-MM-dd&to=yyyy-MM-dd */
export const GET = handler(async (req) => {
  const { supabase } = await requireUser();
  const sp = new URL(req.url).searchParams;
  const from = DateKey.safeParse(sp.get("from"));
  const to = DateKey.safeParse(sp.get("to"));
  const checks = await fetchHabitChecks(supabase, {
    from: from.success ? from.data : undefined,
    to: to.success ? to.data : undefined,
  });
  return json({ checks });
});

/** PUT /api/habit-checks — 날짜별 체크 upsert */
export const PUT = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const { error } = await supabase
    .from("habit_checks")
    .upsert(
      { ...parsed.data, user_id: user.id },
      { onConflict: "habit_id,entry_date" },
    );
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
