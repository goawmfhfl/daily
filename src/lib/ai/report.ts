import { habitDaysBetween, weekdaysLabel } from "@/lib/utils";
import { parseISO } from "date-fns";
import { metricsSummary, seoulHour, WEEKDAY_KO, type ReportMetrics } from "@/lib/report-metrics";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, MODELS } from "@/lib/openai";
import type { UserSettings } from "@/lib/constants";
import type {
  EntryWithTags,
  HabitRow,
  HabitCheckRow,
  ReportContent,
  ReportRow,
  Evidence,
} from "@/lib/types";
import { ReportSchema, type ReportOut } from "./schemas";
import { reportSystemPrompt } from "./prompts";

type RefMap = ReportRefs;

function tagValues(e: EntryWithTags, kind: string) {
  return e.entry_tags.filter((t) => t.kind === kind).map((t) => t.value);
}

/** 기록을 모델 입력용 텍스트로 (항상 날짜 오름차순 → 접두사 캐싱에 유리) */
export function serializeEntries(
  entries: EntryWithTags[],
  habits: HabitRow[],
  checks: HabitCheckRow[],
): { text: string; refs: RefMap } {
  const refs: RefMap = {};
  const habitName = new Map(habits.map((h) => [h.id, h.name]));
  const checksByDate = new Map<string, string[]>();
  for (const c of checks) {
    if (!c.done) continue;
    const name = habitName.get(c.habit_id);
    if (!name) continue;
    (checksByDate.get(c.entry_date) ?? checksByDate.set(c.entry_date, []).get(c.entry_date)!).push(name);
  }

  const lines: string[] = [];
  entries.forEach((e, i) => {
    const ref = i + 1;
    refs[ref] = { id: e.id, date: e.entry_date };
    const meta = [
      `감정: ${tagValues(e, "emotion").join(",") || "-"}`,
      `강도: ${tagValues(e, "intensity")[0] ?? "-"}`,
      `사건: ${tagValues(e, "event").join(",") || "-"}`,
      `스트레스원인: ${tagValues(e, "stressor")[0] ?? "-"}`,
      `스트레스정도: ${tagValues(e, "stress_level")[0] ?? "-"}`,
      `에너지: ${tagValues(e, "energy")[0] ?? "-"}`,
    ].join(" | ");
    const done = checksByDate.get(e.entry_date);
    lines.push(
      `[#${ref}] ${e.entry_date} (${WEEKDAY_KO[parseISO(e.entry_date).getDay()]}) ${writtenAt(e.created_at)} 작성 (${e.mode === "free" ? "메모" : "대화"})`,
      meta,
      done?.length ? `지속활동 완료: ${done.join(", ")}` : "",
      e.content.trim(),
      "",
    );
  });
  return { text: lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n"), refs };
}

/** 한국 시간 HH:mm */
function writtenAt(iso: string) {
  const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", minute: "2-digit" }).format(new Date(iso));
  return `${String(seoulHour(iso)).padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function habitSummary(
  habits: HabitRow[],
  checks: HabitCheckRow[],
  periodStart: string,
  periodEnd: string,
) {
  if (!habits.length) return "등록된 지속 활동 없음.";
  // 분모는 그 활동을 하기로 한 요일만 센다 (예: 평일 활동이면 주말은 제외)
  return habits
    .map((h) => {
      const start = h.started_at > periodStart ? h.started_at : periodStart;
      const due = new Set(habitDaysBetween(h, start, periodEnd));
      const days = Math.max(1, due.size);
      const done = checks.filter((c) => c.habit_id === h.id && c.done && due.has(c.entry_date)).length;
      return `- ${h.name} (${weekdaysLabel(h.weekdays)}): ${done}/${days}일 (${Math.round((done / days) * 100)}%)${h.active ? "" : " [중단됨]"}`;
    })
    .join("\n");
}

function previousSummary(prev: ReportRow | null) {
  if (!prev) return null;
  const c = prev.content_json;
  return [
    `생성일: ${prev.created_at.slice(0, 10)}, 기간: ${prev.period_start}~${prev.period_end}, 기록 ${prev.entry_count}건`,
    `헤드라인: ${c.headline}`,
    `감정 변화: ${c.emotion_trend.summary}`,
    `스트레스 지도: ${c.stress_map.summary}`,
    `대처: ${c.coping.summary}`,
    `지속력: ${c.persistence.summary}`,
    `다음 한 걸음: ${c.next_step.experiment}`,
  ].join("\n");
}

function mapEvidence(list: { ref: number; quote: string }[], refs: RefMap): Evidence[] {
  return list
    .filter((e) => refs[e.ref])
    .map((e) => ({ entry_id: refs[e.ref].id, date: refs[e.ref].date, quote: e.quote }));
}

export function toReportContent(out: ReportOut, refs: RefMap): ReportContent {
  const sec = (s: { summary: string; bullets: string[]; evidence: { ref: number; quote: string }[] }) => ({
    summary: s.summary,
    bullets: s.bullets,
    evidence: mapEvidence(s.evidence, refs),
  });
  return {
    headline: out.headline,
    emotion_trend: sec(out.emotion_trend),
    stress_map: { ...sec(out.stress_map), top_stressors: out.stress_map.top_stressors },
    coping: sec(out.coping),
    self_view: {
      ...sec(out.self_view),
      positive_quotes: mapEvidence(out.self_view.positive_quotes, refs),
      negative_quotes: mapEvidence(out.self_view.negative_quotes, refs),
    },
    happiness_conditions: {
      ...sec(out.happiness_conditions),
      happy: mapEvidence(out.happiness_conditions.happy, refs),
      unhappy: mapEvidence(out.happiness_conditions.unhappy, refs),
      happy_common: out.happiness_conditions.happy_common,
      unhappy_common: out.happiness_conditions.unhappy_common,
    },
    persistence: {
      ...sec(out.persistence),
      sustained: out.persistence.sustained,
      dropped: out.persistence.dropped,
      counterexamples: out.persistence.counterexamples,
    },
    next_step: out.next_step,
    time_patterns: { ...sec(out.time_patterns), items: out.time_patterns.items },
    change_points: out.change_points.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date)),
    comparison_with_previous: out.comparison_with_previous,
  };
}

export interface ReportRefs {
  [ref: number]: { id: string; date: string };
}

/**
 * 리포트 생성을 OpenAI 백그라운드 작업으로 시작한다.
 * 기록이 많으면 생성이 수 분 걸려 서버 함수 실행 제한(Vercel 300초)을 넘기므로,
 * 여기서는 작업만 맡기고 바로 돌아온 뒤 pollReport 로 결과를 받는다.
 */
export async function startReport(input: {
  entries: EntryWithTags[];
  habits: HabitRow[];
  checks: HabitCheckRow[];
  previous: ReportRow | null;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  settings: UserSettings;
  metrics: ReportMetrics;
}): Promise<{ responseId: string; refs: ReportRefs; model: string }> {
  const model = MODELS.report;
  const { text, refs } = serializeEntries(input.entries, input.habits, input.checks);
  const prev = previousSummary(input.previous);

  const userContent = [
    "===== 누적 기록 (날짜 오름차순) =====",
    text,
    "",
    "===== 지속 활동 체크율 (이번 기간) =====",
    habitSummary(input.habits, input.checks, input.periodStart, input.periodEnd),
    "",
    "===== 요일·시간대별 지표 (태그 기준) =====",
    metricsSummary(input.metrics),
    "",
    prev ? `===== 같은 기간의 이전 리포트 =====\n${prev}\n` : "",
    "===== 이번 요청 =====",
    `분석 기간: ${input.periodLabel} (${input.periodStart} ~ ${input.periodEnd}), 기록 ${input.entries.length}건.`,
    "위 기록만을 근거로 리포트를 작성하세요.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const res = await openai().responses.create({
    model,
    background: true,
    ...(model.startsWith("gpt-5") || model.startsWith("o")
      ? { reasoning: { effort: "medium" as const } }
      : {}),
    input: [
      { role: "system", content: reportSystemPrompt(input.settings) },
      { role: "user", content: userContent },
    ],
    text: { format: zodTextFormat(ReportSchema, "self_report") },
  });

  return { responseId: res.id, refs, model };
}

export type ReportPoll =
  | { status: "pending" }
  | { status: "done"; content: ReportContent }
  | { status: "failed"; message: string };

/** 백그라운드 리포트 작업의 상태를 확인하고, 끝났으면 결과를 리포트 형태로 바꾼다 */
export async function pollReport(responseId: string, refs: ReportRefs): Promise<ReportPoll> {
  const res = await openai().responses.retrieve(responseId);
  if (res.status === "queued" || res.status === "in_progress") return { status: "pending" };
  if (res.status !== "completed") {
    const reason = res.error?.message ?? res.incomplete_details?.reason ?? res.status;
    return { status: "failed", message: `리포트 생성이 중단되었습니다 (${reason}).` };
  }

  const text = res.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .map((c) => (c.type === "output_text" ? c.text : ""))
    .join("");
  let out: ReportOut;
  try {
    out = ReportSchema.parse(JSON.parse(text));
  } catch {
    return { status: "failed", message: "리포트 결과를 해석하지 못했습니다." };
  }
  return { status: "done", content: toReportContent(out, refs) };
}
