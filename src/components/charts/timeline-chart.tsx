"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { Segmented } from "@/components/ui/segmented";
import {
  AXIS_TICK,
  EMOTION_CHART_ORDER,
  EmotionLegend,
  GRID_STROKE,
  TooltipFrame,
  emotionColor,
} from "./chart-shared";

export interface TimelineEntry {
  id: string;
  date: string;
  emotions: string[];
  intensity: number | null;
  events: string[];
  stressor: string | null;
  snippet: string;
}

export interface ChangePoint {
  date: string;
  description: string;
}

type Granularity = "week" | "month";

interface Bucket {
  key: string; // yyyy-MM-dd (bucket start)
  label: string;
  count: number;
  avgIntensity: number | null;
  [emotion: string]: string | number | null;
}

function bucketKey(date: string, g: Granularity) {
  const d = parseISO(date);
  return format(g === "week" ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d), "yyyy-MM-dd");
}

function bucketLabel(key: string, g: Granularity) {
  return format(parseISO(key), g === "week" ? "M/d" : "yy.M", { locale: ko });
}

export function aggregate(entries: TimelineEntry[], g: Granularity): Bucket[] {
  const map = new Map<string, { count: number; sum: number; n: number; emo: Record<string, number> }>();
  for (const e of entries) {
    const k = bucketKey(e.date, g);
    const b = map.get(k) ?? { count: 0, sum: 0, n: 0, emo: {} };
    b.count += 1;
    if (e.intensity != null) {
      b.sum += e.intensity;
      b.n += 1;
    }
    for (const m of e.emotions) b.emo[m] = (b.emo[m] ?? 0) + 1;
    map.set(k, b);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, b]) => {
      const row: Bucket = {
        key,
        label: bucketLabel(key, g),
        count: b.count,
        avgIntensity: b.n ? Math.round((b.sum / b.n) * 10) / 10 : null,
      };
      for (const m of EMOTION_CHART_ORDER) row[m] = b.emo[m] ?? 0;
      return row;
    });
}

export function TimelineCharts({
  entries,
  changePoints,
}: {
  entries: TimelineEntry[];
  changePoints: ChangePoint[];
}) {
  const [g, setG] = React.useState<Granularity>("week");
  const data = React.useMemo(() => aggregate(entries, g), [entries, g]);
  const present = EMOTION_CHART_ORDER.filter((m) => data.some((d) => (d[m] as number) > 0));
  const cpKeys = React.useMemo(
    () => changePoints.map((c) => ({ ...c, key: bucketKey(c.date, g) })).filter((c) => data.some((d) => d.key === c.key)),
    [changePoints, data, g],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-caption text-muted">
          {g === "week" ? "주 단위" : "월 단위"} · {data.length}구간
        </p>
        <Segmented<Granularity>
          size="sm"
          value={g}
          onChange={setG}
          options={[
            { value: "week", label: "주" },
            { value: "month", label: "월" },
          ]}
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-heading font-semibold">감정 구성</h3>
        <p className="text-caption text-muted">구간별 감정 태그 수. 세로 점선은 AI가 찾은 변화 구간.</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as Bucket;
                  return (
                    <TooltipFrame
                      title={`${d.label} 구간`}
                      rows={[
                        { label: "기록 수", value: d.count },
                        ...present
                          .filter((m) => (d[m] as number) > 0)
                          .map((m) => ({ label: m, value: d[m] as number, color: emotionColor(m) })),
                      ]}
                    />
                  );
                }}
              />
              {present.map((m, i) => (
                <Bar
                  key={m}
                  dataKey={m}
                  stackId="emo"
                  fill={emotionColor(m)}
                  stroke="var(--surface)"
                  strokeWidth={1}
                  maxBarSize={24}
                  radius={i === present.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
              {cpKeys.map((c) => (
                <ReferenceLine
                  key={c.date}
                  x={bucketLabel(c.key, g)}
                  stroke="var(--accent)"
                  strokeDasharray="3 3"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <EmotionLegend emotions={present} />
      </section>

      <section className="space-y-3">
        <h3 className="text-heading font-semibold">평균 감정 강도</h3>
        <p className="text-caption text-muted">구간별 감정 강도의 평균 (1~5)</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval="preserveStartEnd" />
              <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as Bucket;
                  return (
                    <TooltipFrame
                      title={`${d.label} 구간`}
                      rows={[{ label: "평균 강도", value: d.avgIntensity ?? "-" }, { label: "기록 수", value: d.count }]}
                    />
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="avgIntensity"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
