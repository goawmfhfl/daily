import * as React from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-card px-5 py-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-caption font-medium text-muted">{label}</p>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-display font-semibold tabular leading-none tracking-tight">
          {value}
        </span>
        {unit && <span className="text-caption text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-caption text-subtle">{hint}</p>}
    </div>
  );
}
