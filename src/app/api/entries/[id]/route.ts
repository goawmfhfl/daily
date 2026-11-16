import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { embed } from "@/lib/openai";
import { fetchEntry } from "@/lib/data";

const Patch = z.object({
  content: z.string().trim().min(1).max(20000).optional(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const entry = await fetchEntry(supabase, id);
  if (!entry) return fail("기록을 찾을 수 없습니다.", 404);
  return json({ entry });
});

export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");

  const { data, error } = await supabase
    .from("entries")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  if (parsed.data.content) {
    const vector = await embed(parsed.data.content);
    if (vector) {
      await supabase
        .from("entry_embeddings")
        .upsert({ entry_id: id, user_id: user.id, embedding: vector });
    }
  }
  return json({ entry: data });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
