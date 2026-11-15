"use client";

import { cn } from "@/lib/utils";

const LABELS = ["아주 약함", "약함", "보통", "강함", "아주 강함"];

export function IntensityPicker({
  value,
  onChange,
  color = "var(--accent)",
  label,
  className,
}: {
  value: number | null;
  onChange: (v: number) => void;
  color?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-caption font-medium text-muted">{label}</span>
        )}
        <span className="text-caption text-subtle tabular">
          {value ? `${value} · ${LABELS[value - 1]}` : "선택"}
        </span>
      </div>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n}`}
              onClick={() => onChange(n)}
              className={cn(
                "h-9 flex-1 rounded-sm border transition-[background-color,border-color,transform] active:scale-[0.97]",
                on ? "border-transparent" : "border-border bg-surface hover:bg-surface-2",
              )}
              style={
                on
                  ? {
                      background: `color-mix(in oklab, ${color} ${30 + n * 14}%, var(--surface))`,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
