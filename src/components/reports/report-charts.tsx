"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateKo } from "@/lib/utils";
import { TIME_SLOTS, type ReportMetrics } from "@/lib/report-metrics";
import {
  AXIS_TICK,
  EMOTION_CHART_ORDER,
  EmotionLegend,
  GRID_STROKE,
  TooltipFrame,
  emotionColor,
} from "@/components/charts/chart-shared";

const STRESS = "var(--warning)";
const ENERGY = "var(--accent)";
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function SeriesLegend() {
  return (
    <ul className="flex gap-4 text-caption text-muted">
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-3.5 rounded-full" style={{ background: STRESS }} /> 스트레스
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-3.5 rounded-full" style={{ background: ENERGY }} /> 에너지
      </li>
    </ul>
  );
}

/** 기간 동안 스트레스·에너지 흐름 + 그날(그 주) 가장 많이 나온 감정 */
export function FlowChart({ metrics }: { metrics: ReportMetrics }) {
  const { flow, granularity } = metrics;
  const short = granularity === "day" && flow.length <= 14;
  const tick = (date: string) =>
    granularity === "week" ? formatDateKo(date, "M/d") : short ? formatDateKo(date, "EEE") : formatDateKo(date, "d");
  const present = EMOTION_CHART_ORDER.filter((e) => flow.some((p) => p.emotion === e));

  return (
    <div className="space-y-3">
      <SeriesLegend />
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={flow} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              tickFormatter={tick}
              interval={short ? 0 : "preserveStartEnd"}
              minTickGap={8}
            />
            <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={34} />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const p = payload[0].payload as (typeof flow)[number];
                return (
                  <TooltipFrame
                    title={
                      granularity === "week"
                        ? `${formatDateKo(p.date, "M월 d일")} 주`
                        : formatDateKo(p.date, "M월 d일 (EEE)")
                    }
                    rows={
                      p.count === 0
                        ? [{ label: "기록", value: "없음" }]
                        : [
                            { label: "스트레스", value: p.stress ?? "-", color: STRESS },
                            { label: "에너지", value: p.energy ?? "-", color: ENERGY },
                            ...(p.emotion ? [{ label: "주 감정", value: p.emotion, color: emotionColor(p.emotion) }] : []),
                            { label: "기록 수", value: p.count },
                          ]
                    }
                  />
                );
              }}
            />
            <Line
              dataKey="stress"
              stroke={STRESS}
              strokeWidth={2}
              dot={{ r: 3, fill: STRESS, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="energy"
              stroke={ENERGY}
              strokeWidth={2}
              dot={{ r: 3, fill: ENERGY, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* 주 감정 점: 차트의 각 점 바로 아래 (플롯 영역 좌 12px · 우 8px 에 맞춤) */}
      <div className="relative ml-3 mr-2 h-3" aria-label="날짜별 주 감정">
        {flow.map((p, i) => (
          <span
            key={p.date}
            title={`${formatDateKo(p.date, "M월 d일 (EEE)")} · ${p.emotion ?? "기록 없음"}`}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${short ? "size-3" : "size-1.5"}`}
            style={{
              left: flow.length > 1 ? `${(i / (flow.length - 1)) * 100}%` : "50%",
              background: p.emotion ? emotionColor(p.emotion) : "var(--surface-3)",
            }}
          />
        ))}
      </div>
      <EmotionLegend emotions={present} />
    </div>
  );
}

/** 1~5 값을 진하기로. 값이 없으면 빈 칸 */
function scaleBg(color: string, v: number | null) {
  if (v == null) return "var(--surface-2)";
  const pct = Math.round(12 + ((v - 1) / 4) * 70);
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

/** -1~1 기분 균형을 긍정/부정 색으로 */
function moodBg(v: number | null) {
  if (v == null) return "var(--surface-2)";
  const color = v >= 0 ? "var(--calm)" : "var(--anger)";
  return `color-mix(in oklab, ${color} ${Math.round(12 + Math.abs(v) * 70)}%, transparent)`;
}

function moodLabel(v: number | null) {
  if (v == null) return "-";
  if (v >= 0.34) return "좋음";
  if (v <= -0.34) return "나쁨";
  return "보통";
}

/** 요일별 스트레스·에너지·기분 히트맵 */
export function WeekdayHeatmap({ metrics }: { metrics: ReportMetrics }) {
  const rows: { label: string; cell: (d: ReportMetrics["weekday"][number]) => { bg: string; text: string } }[] = [
    { label: "스트레스", cell: (d) => ({ bg: scaleBg(STRESS, d.stress), text: d.stress?.toFixed(1) ?? "-" }) },
    { label: "에너지", cell: (d) => ({ bg: scaleBg(ENERGY, d.energy), text: d.energy?.toFixed(1) ?? "-" }) },
    { label: "기분", cell: (d) => ({ bg: moodBg(d.mood), text: moodLabel(d.mood) }) },
  ];
  const days = WEEK_ORDER.map((d) => metrics.weekday[d]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-separate border-spacing-1 text-center text-caption">
        <thead>
          <tr>
            <th className="w-14" />
            {days.map((d) => (
              <th key={d.day} className="font-medium text-muted">
                {WEEKDAY_KO[d.day]}
                <span className="block text-micro font-normal text-subtle tabular">{d.count}건</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th className="pr-1 text-left font-medium text-muted">{r.label}</th>
              {days.map((d) => {
                const c = r.cell(d);
                return (
                  <td
                    key={d.day}
                    className="h-8 rounded-md tabular text-micro text-foreground/85"
                    style={{ background: d.count ? c.bg : "var(--surface-2)" }}
                  >
                    {d.count ? c.text : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 기록을 쓴 시간대 분포와 그때의 평균 스트레스 */
export function TimeOfDayBars({ metrics }: { metrics: ReportMetrics }) {
  const max = Math.max(1, ...metrics.time_of_day.map((t) => t.count));
  return (
    <ul className="space-y-2">
      {metrics.time_of_day.map((t) => {
        const slot = TIME_SLOTS.find((s) => s.key === t.slot)!;
        return (
          <li key={t.slot} className="flex items-center gap-3 text-caption">
            <span className="w-16 shrink-0 text-muted">
              {slot.label}
              <span className="ml-1 text-micro text-subtle">{slot.range}</span>
            </span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(t.count / max) * 100}%`, background: scaleBg(STRESS, t.stress ?? 1) }}
              />
            </span>
            <span className="w-24 shrink-0 text-right tabular text-subtle">
              {t.count}건{t.count > 0 && t.stress != null ? ` · 스트레스 ${t.stress.toFixed(1)}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
