import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { TAG_KINDS } from "@/lib/constants";

const Body = z.object({
  tags: z.array(
    z.object({
      kind: z.enum(TAG_KINDS),
      value: z.string().trim().min(1).max(500),
      source: z.enum(["user", "ai"]),
    }),
  ),
});

/**
 * PUT /api/entries/[id]/tags
 * 기록의 태그 전체를 교체한다. 사용자가 확인한 값(source=user)과 AI 값(source=ai)을 구분해 저장.
 */
export const PUT = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");

  const { data: entry } = await supabase
    .from("entries")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!entry) return fail("기록을 찾을 수 없습니다.", 404);

  const del = await supabase.from("entry_tags").delete().eq("entry_id", id);
  if (del.error) return fail(del.error.message, 500);

  if (parsed.data.tags.length) {
    const ins = await supabase.from("entry_tags").insert(
      parsed.data.tags.map((t) => ({ ...t, entry_id: id, user_id: user.id })),
    );
    if (ins.error) return fail(ins.error.message, 500);
  }

  const { data: tags } = await supabase
    .from("entry_tags")
    .select("*")
    .eq("entry_id", id);
  return json({ tags: tags ?? [] });
});
