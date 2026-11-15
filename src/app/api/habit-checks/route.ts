import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";

const Body = z.object({
  habit_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
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
