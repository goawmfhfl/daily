import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeriodKey } from "@/lib/constants";
import type { ReportRefs } from "@/lib/ai/report";
import type { ReportContent, ReportRow } from "@/lib/types";

/** 백그라운드로 생성 중인 리포트 작업. 끝나면 이 정보로 리포트를 저장한다 */
export interface ReportJob {
  response_id: string;
  period_key: PeriodKey;
  period_start: string;
  period_end: string;
  entry_count: number;
  model: string;
  refs: ReportRefs;
}

export async function saveReport(
  supabase: SupabaseClient,
  userId: string,
  job: ReportJob,
  content: ReportContent,
): Promise<ReportRow> {
  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      period_key: job.period_key,
      period_start: job.period_start,
      period_end: job.period_end,
      mode: "analyze",
      content_json: content,
      model: job.model,
      entry_count: job.entry_count,
    })
    .select("*")
    .single<ReportRow>();
  if (error || !report) throw new Error(error?.message ?? "리포트 저장 실패");

  // 근거 기록 테이블에 평탄화 저장
  const evidence = collectEvidence(content).map((e) => ({
    report_id: report.id,
    user_id: userId,
    entry_id: e.entry_id,
    section: e.section,
    quote: e.quote,
  }));
  if (evidence.length) await supabase.from("report_evidence").insert(evidence);
  return report;
}

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
