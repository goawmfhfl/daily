import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { EMOTION_META, type Emotion } from "@/lib/constants";
import type { EntryWithTags } from "@/lib/types";

/**
 * 리포트 생성 시점에 기록 태그로 계산해 리포트에 함께 저장하는 지표.
 * 리포트는 그 시점의 스냅샷이므로, 차트도 다시 생성할 때만 새로 계산된다.
 */

export const TIME_SLOTS = [
  { key: "dawn", label: "새벽", range: "0~6시" },
  { key: "morning", label: "아침", range: "6~12시" },
  { key: "afternoon", label: "오후", range: "12~18시" },
  { key: "evening", label: "저녁", range: "18~22시" },
  { key: "night", label: "밤", range: "22~24시" },
] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number]["key"];

interface Agg {
  count: number;
  /** 평균 스트레스 1~5 (태그 없으면 null) */
  stress: number | null;
  /** 평균 에너지 1~5 */
  energy: number | null;
  /** 기분 균형 -1(부정) ~ 1(긍정). 감정 태그가 없으면 null */
  mood: number | null;
}

export interface FlowPoint extends Agg {
  /** yyyy-MM-dd (주 단위면 그 주 월요일) */
  date: string;
  /** 가장 많이 나온 감정 */
  emotion: string | null;
}

export interface ReportMetrics {
  granularity: "day" | "week";
  flow: FlowPoint[];
  /** 0=일 … 6=토 */
  weekday: (Agg & { day: number })[];
  /** 기록을 쓴 시간대 (한국 시간) */
  time_of_day: (Agg & { slot: TimeSlot })[];
}

function tagNums(e: EntryWithTags, kind: string) {
  return e.entry_tags
    .filter((t) => t.kind === kind)
    .map((t) => Number(t.value))
    .filter((n) => Number.isFinite(n));
}

function aggregate(list: EntryWithTags[]): Agg & { emotion: string | null } {
  const stress = list.flatMap((e) => tagNums(e, "stress_level").slice(0, 1));
  const energy = list.flatMap((e) => tagNums(e, "energy").slice(0, 1));
  const emotions = list.flatMap((e) => e.entry_tags.filter((t) => t.kind === "emotion").map((t) => t.value));
  let pos = 0;
  let neg = 0;
  const freq = new Map<string, number>();
  for (const em of emotions) {
    freq.set(em, (freq.get(em) ?? 0) + 1);
    const polarity = EMOTION_META[em as Emotion]?.polarity;
    if (polarity === "positive") pos++;
    else if (polarity === "negative") neg++;
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    count: list.length,
    stress: avg(stress),
    energy: avg(energy),
    mood: pos + neg ? Math.round(((pos - neg) / (pos + neg)) * 100) / 100 : null,
    emotion: top,
  };
}

/** created_at(UTC) → 한국 시간 시각 */
function seoulHour(iso: string) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(
    new Date(iso),
  );
  return Number(h) % 24;
}

function slotOf(hour: number): TimeSlot {
  if (hour < 6) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

export function computeReportMetrics(entries: EntryWithTags[], periodStart: string, periodEnd: string): ReportMetrics {
  const days = differenceInCalendarDays(parseISO(periodEnd), parseISO(periodStart)) + 1;
  const granularity = days > 90 ? "week" : "day";
  const keyOf = (date: string) =>
    granularity === "week" ? format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd") : date;

  const byKey = new Map<string, EntryWithTags[]>();
  for (const e of entries) {
    const k = keyOf(e.entry_date);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e);
  }

  // 기록이 없는 날(주)도 빈 칸으로 남겨 흐름이 끊긴 곳이 보이게 한다
  const flow: FlowPoint[] = [];
  const step = granularity === "week" ? 7 : 1;
  for (let d = parseISO(keyOf(periodStart)); d <= parseISO(periodEnd); d = addDays(d, step)) {
    const date = format(d, "yyyy-MM-dd");
    flow.push({ date, ...aggregate(byKey.get(date) ?? []) });
  }

  const stats = (list: EntryWithTags[]): Agg => {
    const a = aggregate(list);
    return { count: a.count, stress: a.stress, energy: a.energy, mood: a.mood };
  };
  const weekday = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    ...stats(entries.filter((e) => parseISO(e.entry_date).getDay() === day)),
  }));
  const time_of_day = TIME_SLOTS.map(({ key }) => ({
    slot: key,
    ...stats(entries.filter((e) => slotOf(seoulHour(e.created_at)) === key)),
  }));

  return { granularity, flow, weekday, time_of_day };
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** 모델 입력용 요약 (요일·시간대 패턴을 숫자로 함께 보게 한다) */
export function metricsSummary(m: ReportMetrics) {
  const fmt = (a: Agg) =>
    `${a.count}건, 스트레스 ${a.stress ?? "-"}, 에너지 ${a.energy ?? "-"}, 기분균형 ${a.mood ?? "-"}`;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return [
    "[요일별 평균]",
    ...order.map((d) => `- ${WEEKDAY_KO[d]}: ${fmt(m.weekday[d])}`),
    "[기록을 쓴 시간대별 평균 (한국 시간)]",
    ...m.time_of_day.map((t) => {
      const s = TIME_SLOTS.find((x) => x.key === t.slot)!;
      return `- ${s.label}(${s.range}): ${fmt(t)}`;
    }),
  ].join("\n");
}

export { WEEKDAY_KO, seoulHour };
