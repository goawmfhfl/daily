"use client";

import * as React from "react";
import { EMOTION_META, type Emotion } from "@/lib/constants";

/** 스택·범례용 감정 순서. 인접 색이 색각 이상에서도 구분되도록 검증된 순서. */
export const EMOTION_CHART_ORDER: Emotion[] = [
  "분노",
  "슬픔",
  "기쁨",
  "불안",
  "평온",
  "무기력",
];

export function emotionColor(e: string) {
  return EMOTION_META[e as Emotion]?.color ?? "var(--fg-subtle)";
}

export const AXIS_TICK = {
  fill: "var(--fg-subtle)",
  fontSize: 11,
  fontFamily: "inherit",
} as const;

export const GRID_STROKE = "var(--border)";

/** 툴팁 공통 컨테이너 */
export function TooltipFrame({
  title,
  rows,
  note,
}: {
  title: React.ReactNode;
  rows: { label: string; value: React.ReactNode; color?: string }[];
  note?: React.ReactNode;
}) {
  return (
    <div className="min-w-[160px] rounded-md border border-border bg-surface px-3 py-2 text-caption shadow-md">
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              {r.color && (
                <span className="size-2 rounded-full" style={{ background: r.color }} />
              )}
              {r.label}
            </span>
            <span className="tabular text-foreground">{r.value}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 border-t border-border pt-1.5 text-micro text-subtle">{note}</p>}
    </div>
  );
}

export function EmotionLegend({ emotions }: { emotions: string[] }) {
  if (emotions.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-muted">
      {emotions.map((e) => (
        <li key={e} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: emotionColor(e) }} />
          {e}
        </li>
      ))}
    </ul>
  );
}
