import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { fetchEntries } from "@/lib/data";
import { generateEmotionInsight } from "@/lib/ai/emotion-insight";
import { hasOpenAI } from "@/lib/openai";
import { addDaysKey, weekStartKey } from "@/lib/utils";
import type { EmotionInsightResponse, EmotionInsightRow, EntryWithTags } from "@/lib/types";

const Week = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** 그 주 기록·태그가 바뀌었는지 판단하는 지문 (태그 수정은 기록 수정 시각을 바꾸지 않으므로 태그도 본다) */
function signature(entries: EntryWithTags[]) {
  const tags = entries.flatMap((e) => e.entry_tags);
  const maxOf = (xs: string[]) => xs.reduce((m, x) => (x > m ? x : m), "");
  return [
    entries.length,
    maxOf(entries.map((e) => e.updated_at)),
    tags.length,
    maxOf(tags.map((t) => t.created_at)),
  ].join("|");
}

/** 위기 표시 기록은 분석에서 제외 (사람 우선 원칙) */
async function weekEntries(supabase: SupabaseClient, weekStart: string) {
  const weekEnd = addDaysKey(weekStart, 6);
  const all = await fetchEntries(supabase, { from: weekStart, to: weekEnd, ascending: true });
  return { weekEnd, entries: all.filter((e) => !e.risk_flag) };
}

function parseWeek(raw: unknown) {
  const parsed = Week.safeParse(raw);
  // 어떤 날짜가 와도 그 주의 월요일로 맞춘다
  return parsed.success ? weekStartKey(parsed.data) : null;
}

/** GET /api/emotion-insights?week=yyyy-MM-dd — 저장된 주간 분석 (없으면 만들지 않는다) */
export const GET = handler(async (req) => {
  const { supabase } = await requireUser();
  const weekStart = parseWeek(new URL(req.url).searchParams.get("week"));
  if (!weekStart) return fail("week 형식이 올바르지 않습니다.");

  const [{ entries }, { data: cached }] = await Promise.all([
    weekEntries(supabase, weekStart),
    supabase.from("emotion_insights").select("*").eq("week_start", weekStart).maybeSingle<EmotionInsightRow>(),
  ]);
  if (entries.length === 0) return json<EmotionInsightResponse>({ status: "empty" });
  if (cached) {
    return json<EmotionInsightResponse>({ status: "ok", insight: cached, stale: cached.source_sig !== signature(entries) });
  }
  if (!hasOpenAI()) return json<EmotionInsightResponse>({ status: "no_ai" });
  return json<EmotionInsightResponse>({ status: "none" });
});

/** POST /api/emotion-insights { week } — 그 주를 (다시) 분석해 저장 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const weekStart = parseWeek((await req.json().catch(() => ({})))?.week);
  if (!weekStart) return fail("week 형식이 올바르지 않습니다.");
  if (!hasOpenAI()) return json<EmotionInsightResponse>({ status: "no_ai" });

  const { weekEnd, entries } = await weekEntries(supabase, weekStart);
  if (entries.length === 0) return json<EmotionInsightResponse>({ status: "empty" });

  const { content, model } = await generateEmotionInsight({ weekStart, weekEnd, entries });
  const { data: insight, error } = await supabase
    .from("emotion_insights")
    .upsert(
      {
        user_id: user.id,
        week_start: weekStart,
        content_json: content,
        model,
        entry_count: entries.length,
        source_sig: signature(entries),
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" },
    )
    .select("*")
    .single<EmotionInsightRow>();
  if (error || !insight) return fail(error?.message ?? "분석 저장 실패", 500);

  return json<EmotionInsightResponse>({ status: "ok", insight, stale: false });
});
