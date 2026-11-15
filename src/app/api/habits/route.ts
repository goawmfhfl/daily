import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { todayKey } from "@/lib/utils";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("활동 이름을 입력하세요.");
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      started_at: parsed.data.started_at ?? todayKey(),
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return json({ habit: data });
});
