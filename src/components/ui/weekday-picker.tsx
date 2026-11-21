"use client";

import { WEEKDAY_LABEL, WEEKDAY_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "매일", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "평일", days: [1, 2, 3, 4, 5] },
  { label: "주말", days: [0, 6] },
];

const same = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/**
 * 월~일 요일 토글. 값은 Date.getDay 번호(0=일 … 6=토).
 * 마지막 하나는 끌 수 없다 (활동은 최소 하루는 있어야 한다).
 */
export function WeekdayPicker({
  value,
  onChange,
  disabled,
  presets = false,
  size = "md",
  className,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  presets?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  function toggle(d: number) {
    const on = value.includes(d);
    if (on && value.length === 1) return;
    onChange(on ? value.filter((x) => x !== d) : [...value, d].sort());
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <div className="flex gap-1" role="group" aria-label="요일">
        {WEEKDAY_ORDER.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(d)}
              className={cn(
                "flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50",
                size === "sm" ? "size-7 text-micro" : "size-8 text-caption",
                on
                  ? "bg-accent text-accent-foreground"
                  : "border border-border bg-surface text-muted hover:text-foreground",
                !on && (d === 0 || d === 6) && "text-danger/70",
              )}
            >
              {WEEKDAY_LABEL[d]}
            </button>
          );
        })}
      </div>
      {presets && (
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.days)}
              className={cn(
                "h-7 rounded-full px-2.5 text-micro font-medium transition-colors",
                same(value, p.days)
                  ? "bg-surface-3 text-foreground"
                  : "text-subtle hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
