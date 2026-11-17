import { handler, requireUser, json, fail } from "@/lib/api-server";
import { fetchEntries, fetchHabits, fetchHabitChecks } from "@/lib/data";
import { briefStats, generateBrief } from "@/lib/ai/brief";
import { hasOpenAI } from "@/lib/openai";
import type { BriefResponse, DailyBriefRow } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/briefs?today=yyyy-MM-dd — "어제의 나" 아침 브리핑
 * - 오늘 이전에 기록한 가장 최근 하루를 대상으로 한다 (어제를 건너뛰었으면 그 전날)
 * - 이미 만든 브리핑이 있고 그날 기록이 그대로면 저장본을 돌려준다 → AI 호출은 보통 하루 한 번
 * - 기록이 바뀌었으면(건수·수정 시각) 다시 만든다
 */
export const GET = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const today = new URL(req.url).searchParams.get("today") ?? "";
  if (!DATE.test(today)) return fail("today 형식이 올바르지 않습니다.");

  const { data: last, error: lastErr } = await supabase
    .from("entries")
    .select("entry_date")
    .lt("entry_date", today)
    .order("entry_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ entry_date: string }>();
  if (lastErr) throw lastErr;
  if (!last) return json<BriefResponse>({ status: "none" });

  const date = last.entry_date;
  const entries = await fetchEntries(supabase, { from: date, to: date, ascending: true });
  const entryIds = entries.map((e) => e.id);

  // 위기 표시가 있던 날은 분석하지 않는다 (사람 우선 원칙)
  if (entries.some((e) => e.risk_flag)) {
    return json<BriefResponse>({ status: "care", target_date: date, entry_ids: entryIds });
  }

  const sourceUpdatedAt = entries.reduce((m, e) => (e.updated_at > m ? e.updated_at : m), entries[0].updated_at);
  const [{ data: cached }, habits, checks] = await Promise.all([
    supabase.from("daily_briefs").select("*").eq("target_date", date).maybeSingle<DailyBriefRow>(),
    fetchHabits(supabase),
    fetchHabitChecks(supabase, { from: date, to: date }),
  ]);
  if (
    cached &&
    cached.entry_count === entries.length &&
    new Date(cached.source_updated_at).getTime() >= new Date(sourceUpdatedAt).getTime()
  ) {
    // AI 요약은 저장본, 감정·지표·활동은 지금 기준으로
    const brief = { ...cached, content_json: { ...cached.content_json, ...briefStats(entries, habits, checks, date) } };
    return json<BriefResponse>({ status: "ok", target_date: date, entry_ids: entryIds, brief });
  }

  if (!hasOpenAI()) return json<BriefResponse>({ status: "no_ai", target_date: date, entry_ids: entryIds });

  const { content, model } = await generateBrief({ date, entries, habits, checks });

  const { data: brief, error } = await supabase
    .from("daily_briefs")
    .upsert(
      {
        user_id: user.id,
        target_date: date,
        content_json: content,
        model,
        entry_count: entries.length,
        source_updated_at: sourceUpdatedAt,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,target_date" },
    )
    .select("*")
    .single<DailyBriefRow>();
  if (error || !brief) return fail(error?.message ?? "브리핑 저장 실패", 500);

  return json<BriefResponse>({ status: "ok", target_date: date, entry_ids: entryIds, brief });
});
