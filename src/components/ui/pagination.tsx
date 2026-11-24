"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** 쪽 번호 목록: 처음·끝과 현재 쪽 주변만 보이고 나머지는 … 로 줄인다 (항상 최대 7칸) */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap", pageCount];
  if (page >= pageCount - 3)
    return [1, "gap", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  return [1, "gap", page - 1, page, page + 1, "gap", pageCount];
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const btn =
    "inline-flex size-8 items-center justify-center rounded-md text-caption font-medium tabular transition-colors disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav aria-label="쪽 넘기기" className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        aria-label="이전 쪽"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={cn(btn, "text-muted hover:bg-surface-2 hover:text-foreground")}
      >
        <ChevronLeft className="size-4" />
      </button>
      {pageItems(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="inline-flex size-8 items-center justify-center text-caption text-subtle" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`${p}쪽`}
            className={cn(
              btn,
              p === page
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="다음 쪽"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className={cn(btn, "text-muted hover:bg-surface-2 hover:text-foreground")}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
