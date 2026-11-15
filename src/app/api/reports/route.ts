import { z } from "zod";
import { subDays } from "date-fns";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { MIN_ENTRIES_FOR_REPORT, PERIODS } from "@/lib/constants";
import {
  getSettings,
  fetchEntries,
  fetchHabits,
  fetchHabitChecks,
  fetchReports,
} from "@/lib/data";
import { generateReport } from "@/lib/ai/report";
import { hasOpenAI } from "@/lib/openai";
import { todayKey } from "@/lib/utils";
import type { ReportContent, ReportRow } from "@/lib/types";

const Body = z.object({
  period_key: z.enum(["7d", "30d", "all"]),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /api/reports — 사용자가 "생성"을 눌렀을 때만 리포트를 만든다.
 * 기록이 MIN_ENTRIES_FOR_REPORT 미만이면 모델을 호출하지 않고 "아직 말할 수 없다".
 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  const period = PERIODS.find((p) => p.key === parsed.data.period_key)!;
  const today = parsed.data.today ?? todayKey();
  const periodEnd = today;

  // 위기 표시 기록은 분석에서 제외 (사람 우선 원칙)
  const all = await fetchEntries(supabase, {
    from: period.days ? todayKey(subDays(new Date(today), period.days - 1)) : undefined,
    to: periodEnd,
    ascending: true,
  });
  const entries = all.filter((e) => !e.risk_flag);
  const periodStart = period.days
    ? todayKey(subDays(new Date(today), period.days - 1))
    : (entries[0]?.entry_date ?? today);

  if (entries.length < MIN_ENTRIES_FOR_REPORT) {
    return json(
      {
        insufficient: true,
        count: entries.length,
        required: MIN_ENTRIES_FOR_REPORT,
        message: `아직 말할 수 없습니다. ${period.label} 기록이 ${entries.length}건이라 성격을 단정하지 않습니다. ${MIN_ENTRIES_FOR_REPORT}건부터 리포트를 만듭니다.`,
      },
      { status: 200 },
    );
  }

  const [settings, habits, checks, prevList] = await Promise.all([
    getSettings(supabase, user.id),
    fetchHabits(supabase),
    fetchHabitChecks(supabase, { from: periodStart, to: periodEnd }),
    fetchReports(supabase, { periodKey: period.key, limit: 1 }),
  ]);

  const { content, model } = await generateReport({
    entries,
    habits,
    checks,
    previous: prevList[0] ?? null,
    periodStart,
    periodEnd,
    periodLabel: period.label,
    settings,
  });

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      period_key: period.key,
      period_start: periodStart,
      period_end: periodEnd,
      mode: "analyze",
      content_json: content,
      model,
      entry_count: entries.length,
    })
    .select("*")
    .single<ReportRow>();
  if (error || !report) return fail(error?.message ?? "리포트 저장 실패", 500);

  // 근거 기록 테이블에 평탄화 저장
  const evidence = collectEvidence(content).map((e) => ({
    report_id: report.id,
    user_id: user.id,
    entry_id: e.entry_id,
    section: e.section,
    quote: e.quote,
  }));
  if (evidence.length) await supabase.from("report_evidence").insert(evidence);

  return json({ insufficient: false, report });
});

function collectEvidence(c: ReportContent) {
  const out: { section: string; entry_id: string; quote: string }[] = [];
  const push = (section: string, list: { entry_id: string; quote: string }[]) =>
    list.forEach((e) => out.push({ section, entry_id: e.entry_id, quote: e.quote }));
  push("emotion_trend", c.emotion_trend.evidence);
  push("stress_map", c.stress_map.evidence);
  push("coping", c.coping.evidence);
  push("self_view", [
    ...c.self_view.evidence,
    ...c.self_view.positive_quotes,
    ...c.self_view.negative_quotes,
  ]);
  push("happiness_conditions", [
    ...c.happiness_conditions.evidence,
    ...c.happiness_conditions.happy,
    ...c.happiness_conditions.unhappy,
  ]);
  push("persistence", c.persistence.evidence);
  return out;
}
