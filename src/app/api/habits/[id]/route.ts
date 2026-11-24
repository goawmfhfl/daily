import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  active: z.boolean().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).transform((a) => [...new Set(a)].sort()).optional(),
  /** null 이면 이모지 없앰 */
  emoji: z.string().trim().min(1).max(16).nullable().optional(),
});

export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const { data, error } = await supabase
    .from("habits")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return json({ habit: data });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
