"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { HabitRow, HabitCheckRow } from "@/lib/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export function HabitChecklist({
  habits,
  initialChecks,
  dateKey,
}: {
  habits: HabitRow[];
  initialChecks: HabitCheckRow[];
  dateKey: string;
}) {
  const toast = useToast();
  const [done, setDone] = React.useState<Set<string>>(
    () => new Set(initialChecks.filter((c) => c.done).map((c) => c.habit_id)),
  );

  async function toggle(habitId: string) {
    const next = !done.has(habitId);
    setDone((prev) => {
      const s = new Set(prev);
      if (next) s.add(habitId);
      else s.delete(habitId);
      return s;
    });
    try {
      await api("/api/habit-checks", {
        method: "PUT",
        body: { habit_id: habitId, entry_date: dateKey, done: next },
      });
    } catch (e) {
      setDone((prev) => {
        const s = new Set(prev);
        if (next) s.delete(habitId);
        else s.add(habitId);
        return s;
      });
      toast.push({ tone: "error", title: "체크를 저장하지 못했습니다", description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <Card>
      <CardHeader
        title="오늘 이어간 활동"
        description={habits.length ? `${done.size}/${habits.length} 완료` : "지속하고 싶은 활동을 등록하세요"}
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
        {habits.length === 0 ? (
          <p className="text-caption text-muted">
            예: 아침 산책, 영어 10분, 코딩 1시간. 설정에서 추가할 수 있습니다.
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
