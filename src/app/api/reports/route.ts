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
import { startReport } from "@/lib/ai/report";
import { hasOpenAI } from "@/lib/openai";
import { todayKey } from "@/lib/utils";
import type { ReportJob } from "@/lib/report-store";
import { computeReportMetrics } from "@/lib/report-metrics";

const Body = z.object({
  period_key: z.enum(["7d", "30d", "all"]),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** GET /api/reports — 리포트 목록(본문 포함), 최신순 */
export const GET = handler(async () => {
  const { supabase } = await requireUser();
  return json({ reports: await fetchReports(supabase, { limit: 50 }) });
});

/**
 * POST /api/reports — 사용자가 "생성"을 눌렀을 때만 리포트 생성을 시작한다.
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

  // 흐름·요일·시간대 차트용 지표는 생성 시점의 기록으로 계산해 리포트에 함께 저장한다
  const metrics = computeReportMetrics(entries, periodStart, periodEnd);

  // 생성은 수 분 걸릴 수 있어 백그라운드로 맡기고, 클라이언트가 /api/reports/poll 로 결과를 받는다
  const { responseId, refs, model } = await startReport({
    entries,
    habits,
    checks,
    previous: prevList[0] ?? null,
    periodStart,
    periodEnd,
    periodLabel: period.label,
    settings,
    metrics,
  });

  const job: ReportJob = {
    response_id: responseId,
    period_key: period.key,
    period_start: periodStart,
    period_end: periodEnd,
    entry_count: entries.length,
    model,
    refs,
    metrics,
  };
  return json({ insufficient: false, pending: true, job });
});
