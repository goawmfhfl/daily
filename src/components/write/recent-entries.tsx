"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEntries } from "@/lib/query/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeDayLabel, truncate } from "@/lib/utils";
import { EmotionDot } from "@/components/ui/chip";
import { SectionTitle } from "@/components/ui/page-header";

const RECENT_COUNT = 12;

export function RecentEntries({ today }: { today: string }) {
  const { data, isPending } = useEntries();
  const entries = React.useMemo(() => (data ?? []).slice(0, RECENT_COUNT), [data]);

  return (
    <div className="space-y-3">
      <SectionTitle
        action={
          <Link
            href="/entries"
            className="inline-flex items-center gap-1 text-caption text-muted hover:text-foreground"
          >
            전체 <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        최근 기록
      </SectionTitle>
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong/70 px-4 py-6 text-center text-caption text-muted">
          아직 기록이 없습니다. 첫 기록이 첫 번째 지속력 실험입니다.
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => {
            const emotions = e.entry_tags
              .filter((t) => t.kind === "emotion")
              .map((t) => t.value);
            return (
              <li key={e.id}>
                <Link
                  href={`/entries/${e.id}`}
                  className="block rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-micro font-semibold uppercase tracking-wide text-subtle">
                      {relativeDayLabel(e.entry_date, today)}
                    </span>
                    <span className="flex gap-1">
                      {emotions.map((m) => (
                        <EmotionDot key={m} emotion={m} className="size-2" />
                      ))}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-caption text-foreground/85">
                    {truncate(e.content, 90)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
