"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { format, subMinutes } from "date-fns";
import { cn } from "@/lib/utils";

/** 바로 고르기: 저장한 시각 기준으로 얼마 전 */
const QUICK = [
  { label: "지금", minutes: 0 },
  { label: "30분 전", minutes: 30 },
  { label: "1시간 전", minutes: 60 },
  { label: "3시간 전", minutes: 180 },
] as const;

/**
 * HH:mm 을 저장 시각 이전의 가장 가까운 순간으로.
 * 새벽 1시에 "23:00"을 고르면 어제 밤 11시로 본다 (떠오른 시각은 항상 과거).
 */
export function resolveClock(hhmm: string, base: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  if (d.getTime() > base.getTime() + 60_000) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * 떠오른 시각 고르기. 기본값은 저장한 시각.
 * value 가 null 이면 "저장한 시각 그대로".
 */
export function OccurredTimePicker({
  base,
  value,
  onChange,
}: {
  /** 저장한 시각 (기본값이자 "~전" 기준) */
  base: Date;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const current = value ?? base;
  const clock = format(current, "HH:mm");
  const yesterday = format(current, "yyyy-MM-dd") !== format(base, "yyyy-MM-dd");
  const activeQuick = value === null ? 0 : QUICK.find((q) => q.minutes && +subMinutes(base, q.minutes) === +value)?.minutes;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption font-medium text-muted">떠오른 시각</p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-micro font-medium text-subtle hover:text-foreground"
          >
            저장한 시각으로
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label
          className={cn(
            "relative inline-flex h-8 items-center gap-1.5 rounded-full border px-3 transition-colors focus-within:ring-2 focus-within:ring-accent/40",
            value && activeQuick === undefined ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-surface",
          )}
        >
          <Clock className="size-3.5 opacity-70" />
          {yesterday && <span className="text-caption font-medium">어제</span>}
          <input
            type="time"
            value={clock}
            onChange={(e) => {
              if (!e.target.value) return;
              const d = resolveClock(e.target.value, base);
              onChange(format(d, "yyyy-MM-dd HH:mm") === format(base, "yyyy-MM-dd HH:mm") ? null : d);
            }}
            aria-label="떠오른 시각"
            className="w-[7.5rem] bg-transparent text-caption font-semibold tabular outline-none [color-scheme:light_dark]"
          />
        </label>
        {QUICK.map((q) => {
          const active = activeQuick === q.minutes;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.minutes ? subMinutes(base, q.minutes) : null)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-caption font-medium transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted hover:text-foreground",
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
