import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { nextWrongState } from "@/lib/hsk";
import { addDaysKey } from "@/lib/utils";
import type { HskAttemptRow, HskSetRow, HskWrongRow } from "@/lib/types";

const Body = z.object({
  set_id: z.string().uuid(),
  mode: z.enum(["first", "retry"]),
  /** 빈칸 번호 → 고른 보기. 다시 풀기는 틀렸던 빈칸만 */
  selected: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(3)),
  duration_sec: z.number().int().min(0).max(24 * 3600).optional(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /api/hsk/attempts — 채점은 서버에서. 오답노트도 여기서 갱신한다.
 * - 처음 풀이: 틀린 빈칸을 오답노트에 (내일 복습)
 * - 다시 풀기: 맞히면 다음 단계, 틀리면 처음 단계로
 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const { set_id, mode, selected, duration_sec, today } = parsed.data;

  const { data: set } = await supabase.from("hsk_sets").select("*").eq("id", set_id).maybeSingle<HskSetRow>();
  if (!set) return fail("세트를 찾을 수 없습니다.", 404);

  const graded = set.blanks
    .filter((b) => String(b.no) in selected)
    .map((b) => ({ no: b.no, selected: selected[String(b.no)], answer: b.answer, correct: selected[String(b.no)] === b.answer }));
  if (!graded.length) return fail("고른 답이 없습니다.");
  if (mode === "first" && graded.length !== set.blanks.length) return fail("모든 빈칸을 골라 주세요.");

  const { data: attempt, error } = await supabase
    .from("hsk_attempts")
    .insert({
      user_id: user.id,
      set_id,
      mode,
      selected,
      correct: graded.filter((g) => g.correct).length,
      total: graded.length,
      duration_sec: duration_sec ?? null,
    })
    .select("*")
    .single<HskAttemptRow>();
  if (error || !attempt) return fail(error?.message ?? "저장하지 못했습니다.", 500);

  if (mode === "first") {
    const wrong = graded.filter((g) => !g.correct);
    if (wrong.length) {
      const { error: wErr } = await supabase.from("hsk_wrong").upsert(
        wrong.map((g) => ({
          user_id: user.id,
          set_id,
          blank_no: g.no,
          selected: g.selected,
          answer: g.answer,
          stage: 0,
          due_on: addDaysKey(today, 1),
          review_count: 0,
          resolved_at: null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,set_id,blank_no" },
      );
      if (wErr) return fail(wErr.message, 500);
    }
  } else {
    const { data: rows } = await supabase
      .from("hsk_wrong")
      .select("*")
      .eq("set_id", set_id)
      .in("blank_no", graded.map((g) => g.no));
    await Promise.all(
      ((rows ?? []) as HskWrongRow[]).map((w) => {
        const g = graded.find((x) => x.no === w.blank_no)!;
        return supabase
          .from("hsk_wrong")
          .update({ ...nextWrongState(w, g.correct, today), selected: g.selected, updated_at: new Date().toISOString() })
          .eq("id", w.id);
      }),
    );
  }

  return json({ attempt, graded });
});
