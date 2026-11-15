import { cn } from "@/lib/utils";

export interface MeterRow {
  name: string;
  value: number; // 0..1
  figure: string;
  hint?: string;
  tone?: "accent" | "warning" | "danger" | "muted";
}

const tones = {
  accent: "var(--accent)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  muted: "var(--fg-subtle)",
};

/** 이름 + 막대 + 수치. 비율 목록용 (dataviz: meter list). */
export function MeterList({ rows, className }: { rows: MeterRow[]; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="truncate text-body font-medium">{r.name}</p>
            {r.hint && <p className="text-micro text-subtle">{r.hint}</p>}
          </div>
          <span className="text-caption tabular text-muted">{r.figure}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(2, Math.min(100, r.value * 100))}%`,
                background: tones[r.tone ?? "accent"],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
