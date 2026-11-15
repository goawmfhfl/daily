import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-caption font-medium text-accent">{eyebrow}</p>
        )}
        <h1 className="text-title font-semibold text-foreground sm:text-display">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-body text-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function SectionTitle({
  children,
  className,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h2 className="text-caption font-semibold uppercase tracking-wider text-subtle">
        {children}
      </h2>
      {action}
    </div>
  );
}
