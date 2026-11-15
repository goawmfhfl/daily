"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateKo } from "@/lib/utils";
import {
  AXIS_TICK,
  EMOTION_CHART_ORDER,
  EmotionLegend,
  GRID_STROKE,
  TooltipFrame,
  emotionColor,
} from "./chart-shared";

export interface DayPoint {
  date: string; // yyyy-MM-dd
  intensity: number; // 0 = 기록 없음
  emotion: string | null; // 주 감정
  emotions: string[];
  count: number;
}

/**
 * 최근 N일 감정 흐름.
 * 막대 높이 = 그날 최대 감정 강도, 색 = 주 감정. 기록이 없는 날은 빈 슬롯.
 */
export function EmotionFlowChart({ data }: { data: DayPoint[] }) {
  const present = EMOTION_CHART_ORDER.filter((e) =>
    data.some((d) => d.emotions.includes(e)),
  );
  return (
    <div className="space-y-3">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: -22, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              tickFormatter={(v: string) => formatDateKo(v, "d")}
              interval={data.length > 20 ? 3 : 1}
            />
            <YAxis domain={[0, 5]} ticks={[1, 3, 5]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={34} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as DayPoint;
                return (
                  <TooltipFrame
                    title={formatDateKo(d.date, "M월 d일 (EEE)")}
                    rows={
                      d.count === 0
                        ? [{ label: "기록", value: "없음" }]
                        : [
                            { label: "감정 강도", value: `${d.intensity}/5` },
                            ...d.emotions.map((e) => ({ label: e, value: "", color: emotionColor(e) })),
                            { label: "기록 수", value: d.count },
                          ]
                    }
                  />
                );
              }}
            />
            <Bar dataKey="intensity" maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell
                  key={d.date}
                  fill={d.emotion ? emotionColor(d.emotion) : "var(--surface-3)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <EmotionLegend emotions={present} />
    </div>
  );
}
