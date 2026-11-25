import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";

const Patch = z.union([
  /** "정답이 이상해요": 풀·오답노트·기록에서 뺀다 */
  z.object({ status: z.literal("reported") }),
  /** 만드는 동안 기다리지 않고 돌아갔으면, 완성된 세트를 풀로 돌려놓는다 */
  z.object({ return_to_pool: z.literal(true) }),
]);

export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const patch = "status" in parsed.data ? { status: "reported" } : { served_at: null };
  const { error } = await supabase.from("hsk_sets").update(patch).eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
