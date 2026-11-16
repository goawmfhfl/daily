"use client";

import * as React from "react";
import { Plus, Pause, Play, Trash2, Pencil, Check, X } from "lucide-react";
import { useCreateHabit, useDeleteHabit, useHabits, useUpdateHabit } from "@/lib/query/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateKo, todayKey } from "@/lib/utils";
import type { HabitRow } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function HabitsManager() {
  const toast = useToast();
  const habitsQuery = useHabits();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const [name, setName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const busy = createHabit.isPending || updateHabit.isPending || deleteHabit.isPending;
  const habits = habitsQuery.data ?? [];

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.push({ tone: "success", title: ok });
    } catch (e) {
      toast.push({ tone: "error", title: "실패", description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <Card>
      <CardHeader
        title="지속하고 싶은 활동"
        description="기록 화면에서 매일 체크합니다. 지속력 분석의 핵심 데이터입니다."
      />
      <CardBody className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void run(
              () => createHabit.mutateAsync(name.trim()).then(() => setName("")),
              "활동을 추가했습니다",
            );
          }}
          className="flex gap-2"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 아침 산책, 영어 10분" maxLength={60} />
          <Button type="submit" variant="secondary" disabled={!name.trim() || busy}>
            <Plus className="size-4" /> 추가
          </Button>
        </form>

        {habitsQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : habits.length === 0 ? (
          <p className="text-caption text-muted">아직 없습니다. 작게 시작하세요. 하나면 충분합니다.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {habits.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === h.id ? (
                  <HabitEditRow
                    habit={h}
                    busy={updateHabit.isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(patch) => {
                      if (!patch) return setEditingId(null);
                      void run(
                        () => updateHabit.mutateAsync({ id: h.id, ...patch }).then(() => setEditingId(null)),
                        "활동을 수정했습니다",
                      );
                    }}
                  />
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={h.active ? "font-medium" : "font-medium text-muted line-through"}>{h.name}</p>
                      <p className="text-micro text-subtle">{formatDateKo(h.started_at, "yyyy.MM.dd")} 시작</p>
                    </div>
                    {!h.active && <Badge>중단</Badge>}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="수정"
                      disabled={busy}
                      onClick={() => setEditingId(h.id)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={h.active ? "중단" : "재개"}
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => updateHabit.mutateAsync({ id: h.id, active: !h.active }),
                          h.active ? "활동을 중단했습니다" : "활동을 재개했습니다",
                        )
                      }
                    >
                      {h.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="삭제"
                      disabled={busy}
                      className="text-danger hover:text-danger"
                      onClick={() => {
                        if (!window.confirm(`"${h.name}" 활동과 체크 기록을 모두 삭제할까요?`)) return;
                        void run(() => deleteHabit.mutateAsync(h.id), "활동을 삭제했습니다");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** 활동 이름·시작일 수정. Enter 저장, Esc 취소. 바뀐 것이 없으면 그냥 닫는다 */
function HabitEditRow({
  habit,
  busy,
  onSave,
  onCancel,
}: {
  habit: HabitRow;
  busy: boolean;
  onSave: (patch: { name?: string; started_at?: string } | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(habit.name);
  const [startedAt, setStartedAt] = React.useState(habit.started_at);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || !startedAt) return;
    const patch: { name?: string; started_at?: string } = {};
    if (trimmed !== habit.name) patch.name = trimmed;
    if (startedAt !== habit.started_at) patch.started_at = startedAt;
    onSave(Object.keys(patch).length ? patch : null);
  }

  return (
    <form
      className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        aria-label="활동 이름"
        className="h-9 min-w-0 flex-1"
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={startedAt}
          max={todayKey()}
          onChange={(e) => setStartedAt(e.target.value)}
          aria-label="시작일"
          className="h-9 w-auto"
        />
        <Button type="submit" variant="ghost" size="icon" aria-label="저장" loading={busy} disabled={!name.trim() || !startedAt}>
          <Check className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="취소" onClick={onCancel} disabled={busy}>
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
