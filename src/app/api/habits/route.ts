import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { todayKey } from "@/lib/utils";
import { fetchHabits } from "@/lib/data";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform((a) => [...new Set(a)].sort()).optional(),
  emoji: z.string().trim().min(1).max(16).nullable().optional(),
});

export const GET = handler(async () => {
  const { supabase } = await requireUser();
  return json({ habits: await fetchHabits(supabase) });
});

export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("활동 이름을 입력하세요.");
  // 새 활동은 맨 뒤에
  const { data: last } = await supabase
    .from("habits")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      started_at: parsed.data.started_at ?? todayKey(),
      ...(parsed.data.weekdays ? { weekdays: parsed.data.weekdays } : {}),
      ...(parsed.data.emoji ? { emoji: parsed.data.emoji } : {}),
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return json({ habit: data });
});
