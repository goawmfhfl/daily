"use client";

import * as React from "react";
import { Brain, CalendarCheck } from "lucide-react";
import type { ZhVocabRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dueLabel, NEW_PER_SESSION, STATUS_META, vocabStatus, type VocabStatus } from "@/lib/zh-review";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export const STATUS_ORDER: VocabStatus[] = ["new", "learning", "due", "scheduled", "mastered"];

export function countStatuses(items: ZhVocabRow[], today: string) {
  const c: Record<VocabStatus, number> = { new: 0, learning: 0, due: 0, scheduled: 0, mastered: 0 };
  for (const v of items) c[vocabStatus(v, today)] += 1;
  return c;
}

/** 오늘 외울 순서: 복습할 때가 된 것(오래된 순) → 외우는 중 → 새 단어(먼저 넣은 순, 한 번에 20개) */
export function buildQueue(items: ZhVocabRow[], today: string) {
  const by = (s: VocabStatus) => items.filter((v) => vocabStatus(v, today) === s);
  const due = by("due").sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const learning = by("learning").sort((a, b) => (a.last_reviewed_at ?? "").localeCompare(b.last_reviewed_at ?? ""));
  const fresh = by("new")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, NEW_PER_SESSION);
  return [...due, ...learning, ...fresh].map((v) => v.id);
}

/**
 * 단어장 위: 오늘 외울 것과 상태별 분포.
 * 아래 막대의 각 상태를 누르면 그 상태 단어만 목록에 보인다.
 */
export function ReviewSummary({
  items,
  today,
  status,
  onStatusChange,
  onStart,
}: {
  items: ZhVocabRow[];
  today: string;
  status: VocabStatus | null;
  onStatusChange: (s: VocabStatus | null) => void;
  onStart: () => void;
}) {
  const counts = React.useMemo(() => countStatuses(items, today), [items, today]);
  const todayCount = counts.due + counts.learning + Math.min(counts.new, NEW_PER_SESSION);
  const total = items.length;

  // 오늘 할 게 없을 때 다음 복습 안내
  const next = React.useMemo(() => {
    const upcoming = items
      .filter((v) => vocabStatus(v, today) === "scheduled" && v.due_on)
      .map((v) => v.due_on!)
      .sort();
    if (!upcoming.length) return null;
    const day = upcoming[0];
    return { label: dueLabel(day, today), count: upcoming.filter((d) => d === day).length };
  }, [items, today]);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              todayCount ? "bg-accent-soft text-accent" : "bg-success-soft text-success",
            )}
          >
            {todayCount ? <Brain className="size-5" /> : <CalendarCheck className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            {todayCount ? (
              <>
                <p className="text-heading font-semibold">
                  오늘 외울 단어 <span className="tabular text-accent">{todayCount}</span>
                </p>
                <p className="text-caption text-muted">
                  {[
                    counts.due && `복습 ${counts.due}`,
                    counts.learning && `외우는 중 ${counts.learning}`,
                    counts.new && `새 단어 ${Math.min(counts.new, NEW_PER_SESSION)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {counts.new > NEW_PER_SESSION && ` (남은 새 단어 ${counts.new - NEW_PER_SESSION}개는 다음에)`}
                </p>
              </>
            ) : (
              <>
                <p className="text-heading font-semibold">오늘 외울 건 다 했어요</p>
                <p className="text-caption text-muted">
                  {next ? `다음 복습: ${next.label.replace(" 복습", "")} ${next.count}개` : "새 단어를 넣으면 여기서 외울 수 있어요."}
                </p>
              </>
            )}
          </div>
          <Button variant="accent" onClick={onStart} disabled={!todayCount} className="w-full sm:w-auto">
            외우기 시작
          </Button>
        </div>

        {total > 0 && (
          <div className="space-y-2.5">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {STATUS_ORDER.map((s) =>
                counts[s] ? (
                  <span
                    key={s}
                    className={cn("h-full transition-opacity", status && status !== s && "opacity-30")}
                    style={{ flexGrow: counts[s], background: STATUS_META[s].bar }}
                  />
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onStatusChange(active ? null : s)}
                    aria-pressed={active}
                    disabled={!counts[s] && !active}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-caption font-medium transition-colors disabled:opacity-40",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted hover:text-foreground",
                    )}
                  >
                    <span className="size-2 rounded-full" style={{ background: STATUS_META[s].bar }} />
                    {STATUS_META[s].label}
                    <span className="tabular opacity-70">{counts[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
