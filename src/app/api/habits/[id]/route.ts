import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  active: z.boolean().optional(),
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
