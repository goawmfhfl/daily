"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useHabits, useHabitChecks, useToggleHabitCheck } from "@/lib/query/hooks";
import { cn, isHabitDay, weekdayOf } from "@/lib/utils";
import { WEEKDAY_LABEL } from "@/lib/constants";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

export function HabitChecklist({ dateKey }: { dateKey: string }) {
  const toast = useToast();
  const habitsQuery = useHabits();
  const checksQuery = useHabitChecks(dateKey);
  const toggleCheck = useToggleHabitCheck(dateKey);

  const active = React.useMemo(() => (habitsQuery.data ?? []).filter((h) => h.active), [habitsQuery.data]);
  // 오늘 요일에 해당하는 활동만
  const habits = React.useMemo(() => active.filter((h) => isHabitDay(h, dateKey)), [active, dateKey]);
  const dayLabel = WEEKDAY_LABEL[weekdayOf(dateKey)];
  const done = React.useMemo(
    () =>
      new Set(
        (checksQuery.data ?? [])
          .filter((c) => c.entry_date === dateKey && c.done)
          .map((c) => c.habit_id),
      ),
    [checksQuery.data, dateKey],
  );

  function toggle(habitId: string) {
    // 캐시를 먼저 바꾸고(낙관적 업데이트) 실패하면 되돌린다
    toggleCheck.mutate(
      { habit_id: habitId, entry_date: dateKey, done: !done.has(habitId) },
      {
        onError: (e) =>
          toast.push({ tone: "error", title: "체크를 저장하지 못했습니다", description: e.message }),
      },
    );
  }

  if (habitsQuery.isPending || checksQuery.isPending) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="오늘 이어간 활동"
        description={
          habits.length
            ? `${dayLabel}요일 · ${habits.filter((h) => done.has(h.id)).length}/${habits.length} 완료`
            : active.length
              ? `${dayLabel}요일`
              : "지속하고 싶은 활동을 등록하세요"
        }
        action={
          <Link
            href="/settings#habits"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="활동 관리"
          >
            <Plus className="size-4" />
          </Link>
        }
      />
      <CardBody className="pt-4">
        {active.length === 0 ? (
          <p className="text-caption text-muted">
            예: 아침 산책, 영어 10분, 코딩 1시간. 설정에서 요일과 함께 추가할 수 있습니다.
          </p>
        ) : habits.length === 0 ? (
          <p className="text-caption text-muted">
            오늘은 예정된 활동이 없어요. 쉬어 가는 날입니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {habits.map((h) => {
              const on = done.has(h.id);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-body transition-colors hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                        on
                          ? "border-transparent bg-accent text-accent-foreground"
                          : "border-border-strong bg-surface",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn(on && "text-muted line-through decoration-border-strong")}>
                      {h.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
