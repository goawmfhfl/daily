import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { fetchEntries } from "@/lib/data";
import { generateFactorInsight } from "@/lib/ai/factor-insight";
import { hasOpenAI } from "@/lib/openai";
import { addDaysKey } from "@/lib/utils";
import type { EntryWithTags, FactorInsightResponse, FactorInsightRow } from "@/lib/types";

/** 분석 기간: 오늘 포함 최근 30일 (대시보드의 다른 30일 지표와 같은 창) */
const WINDOW_DAYS = 30;
const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * 기간 안 기록·태그가 바뀌었는지 판단하는 지문.
 * 새 기록이 들어오거나 30일 밖으로 기록이 빠지면 개수·id 가 달라지고,
 * 태그 수정은 기록 수정 시각을 바꾸지 않으므로 태그도 본다
 */
function signature(entries: EntryWithTags[]) {
  const tags = entries.flatMap((e) => e.entry_tags);
  const maxOf = (xs: string[]) => xs.reduce((m, x) => (x > m ? x : m), "");
  return [
    entries.length,
    entries[0]?.id ?? "",
    entries.at(-1)?.id ?? "",
    maxOf(entries.map((e) => e.updated_at)),
    tags.length,
    maxOf(tags.map((t) => t.created_at)),
  ].join("|");
}

/** 위기 표시 기록은 분석에서 제외 (사람 우선 원칙) */
async function windowEntries(supabase: SupabaseClient, today: string) {
  const from = addDaysKey(today, -(WINDOW_DAYS - 1));
  const all = await fetchEntries(supabase, { from, to: today, ascending: true });
  return { from, entries: all.filter((e) => !e.risk_flag) };
}

/** GET /api/factor-insights?today=yyyy-MM-dd — 저장된 분석과, 그 뒤로 기록이 바뀌었는지 */
export const GET = handler(async (req) => {
  const { supabase } = await requireUser();
  const today = DateKey.safeParse(new URL(req.url).searchParams.get("today"));
  if (!today.success) return fail("today 형식이 올바르지 않습니다.");

  const [{ entries }, { data: cached }] = await Promise.all([
    windowEntries(supabase, today.data),
    supabase.from("factor_insights").select("*").maybeSingle<FactorInsightRow>(),
  ]);
  if (entries.length === 0) return json<FactorInsightResponse>({ status: "empty" });
  if (cached) {
    return json<FactorInsightResponse>({ status: "ok", insight: cached, stale: cached.source_sig !== signature(entries) });
  }
  if (!hasOpenAI()) return json<FactorInsightResponse>({ status: "no_ai" });
  return json<FactorInsightResponse>({ status: "none" });
});

/** POST /api/factor-insights { today } — 최근 30일을 (다시) 분석해 저장 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const today = DateKey.safeParse((await req.json().catch(() => ({})))?.today);
  if (!today.success) return fail("today 형식이 올바르지 않습니다.");
  if (!hasOpenAI()) return json<FactorInsightResponse>({ status: "no_ai" });

  const { from, entries } = await windowEntries(supabase, today.data);
  if (entries.length === 0) return json<FactorInsightResponse>({ status: "empty" });

  const { content, model } = await generateFactorInsight({ from, to: today.data, entries });
  const { data: insight, error } = await supabase
    .from("factor_insights")
    .upsert(
      {
        user_id: user.id,
        window_from: from,
        window_to: today.data,
        content_json: content,
        model,
        entry_count: entries.length,
        source_sig: signature(entries),
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single<FactorInsightRow>();
  if (error || !insight) return fail(error?.message ?? "분석 저장 실패", 500);

  return json<FactorInsightResponse>({ status: "ok", insight, stale: false });
});
