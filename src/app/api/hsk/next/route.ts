import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import type { HskSetRow } from "@/lib/types";

const Body = z.object({ level: z.number().int().min(1).max(9), topic: z.string().max(20).nullable().optional() });

/** POST /api/hsk/next — 풀에서 가장 오래된 세트를 꺼낸다. 없으면 set: null */
export const POST = handler(async (req) => {
  const { supabase } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const { level, topic } = parsed.data;

  let q = supabase
    .from("hsk_sets")
    .select("*")
    .eq("level", level)
    .eq("status", "active")
    .is("served_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (topic) q = q.eq("topic", topic);
  const { data: found, error } = await q.maybeSingle<HskSetRow>();
  if (error) return fail(error.message, 500);
  if (!found) return json({ set: null });

  const { data: set, error: uErr } = await supabase
    .from("hsk_sets")
    .update({ served_at: new Date().toISOString() })
    .eq("id", found.id)
    .select("*")
    .single<HskSetRow>();
  if (uErr || !set) return fail(uErr?.message ?? "세트를 꺼내지 못했습니다.", 500);
  return json({ set });
});
