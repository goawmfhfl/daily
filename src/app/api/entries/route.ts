import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { detectCrisis } from "@/lib/crisis";
import { AI_MODES } from "@/lib/constants";
import { getSettings, fetchHabits } from "@/lib/data";
import { suggestTagsAndReply } from "@/lib/ai/tagging";
import { embed, hasOpenAI } from "@/lib/openai";
import type { EntryRow, TagSuggestion } from "@/lib/types";

const Body = z.object({
  content: z.string().trim().min(1).max(20000),
  mode: z.enum(["free", "dialogue"]),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ai_mode: z.enum(AI_MODES).optional(),
});

/**
 * POST /api/entries
 * 1) 위기 표현 1차 감지 → 감지되면 태깅/응답 없이 저장만 하고 crisis=true 반환
 * 2) 저장 → AI 태그 제안 + 한 줄 응답 → 임베딩
 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const body = parsed.data;

  const settings = await getSettings(supabase, user.id);
  const aiMode = body.ai_mode ?? settings.default_ai_mode;
  const ruleCrisis = detectCrisis(body.content);

  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      content: body.content,
      mode: body.mode,
      entry_date: body.entry_date,
      ai_mode: aiMode,
      risk_flag: ruleCrisis,
    })
    .select("*")
    .single<EntryRow>();
  if (error || !entry) return fail(error?.message ?? "저장 실패", 500);

  if (ruleCrisis) {
    return json({ entry, crisis: true, suggestion: null });
  }

  let suggestion: TagSuggestion | null = null;
  let aiError: string | null = null;

  if (hasOpenAI()) {
    try {
      const habits = await fetchHabits(supabase, true);
      suggestion = await suggestTagsAndReply({
        content: body.content,
        entryDate: body.entry_date,
        mode: body.mode,
        aiMode,
        settings,
        habitNames: habits.map((h) => h.name),
      });
    } catch (e) {
      console.error("[tagging]", e);
      aiError = e instanceof Error ? e.message : "AI 응답 실패";
    }
  } else {
    aiError = "OPENAI_API_KEY 가 설정되지 않아 태그 제안을 건너뜁니다.";
  }

  if (suggestion?.risk) {
    await supabase.from("entries").update({ risk_flag: true }).eq("id", entry.id);
    return json({ entry: { ...entry, risk_flag: true }, crisis: true, suggestion: null });
  }

  if (suggestion) {
    await supabase
      .from("entries")
      .update({ ai_reply: suggestion.reply })
      .eq("id", entry.id);
    // AI 추출 태그는 즉시 저장(source=ai). 사용자가 확인하면 PUT /tags 로 덮어쓴다.
    const aiTags = [
      ...suggestion.emotions.map((v) => ({ kind: "emotion", value: v })),
      { kind: "intensity", value: String(suggestion.intensity) },
      ...suggestion.events.map((v) => ({ kind: "event", value: v })),
      ...(suggestion.stressor ? [{ kind: "stressor", value: suggestion.stressor }] : []),
      { kind: "energy", value: String(suggestion.energy) },
      { kind: "stress_level", value: String(suggestion.stress_level) },
      ...suggestion.self_view_positive.map((v) => ({ kind: "self_view_positive", value: v })),
      ...suggestion.self_view_negative.map((v) => ({ kind: "self_view_negative", value: v })),
    ].map((t) => ({ ...t, entry_id: entry.id, user_id: user.id, source: "ai" }));
    if (aiTags.length) await supabase.from("entry_tags").insert(aiTags);
  }

  // 의미 검색용 임베딩 (실패해도 저장은 유지)
  const vector = await embed(body.content);
  if (vector) {
    await supabase
      .from("entry_embeddings")
      .upsert({ entry_id: entry.id, user_id: user.id, embedding: vector });
  }

  return json({
    entry: { ...entry, ai_reply: suggestion?.reply ?? null },
    crisis: false,
    suggestion,
    ai_error: aiError,
  });
});
