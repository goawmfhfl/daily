"use client";

import * as React from "react";
import Link from "next/link";
import { Check, GripVertical, Plus } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HabitRow } from "@/lib/types";
import {
  useHabits,
  useHabitChecks,
  useReorderHabits,
  useToggleHabitCheck,
  useUpdateHabit,
} from "@/lib/query/hooks";
import { cn, isHabitDay, weekdayOf } from "@/lib/utils";
import { WEEKDAY_LABEL } from "@/lib/constants";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

/** 위아래로만 끌리게 */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function HabitChecklist({ dateKey }: { dateKey: string }) {
  const toast = useToast();
  const habitsQuery = useHabits();
  const checksQuery = useHabitChecks(dateKey);
  const toggleCheck = useToggleHabitCheck(dateKey);
  const reorder = useReorderHabits();
  const updateHabit = useUpdateHabit();

  const all = React.useMemo(() => habitsQuery.data ?? [], [habitsQuery.data]);
  const active = React.useMemo(() => all.filter((h) => h.active), [all]);
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

  const sensors = useSensors(
    // 살짝 움직여야 끌기 시작 (손잡이를 눌렀다 떼는 건 무시)
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // 터치는 잠깐 누르고 있어야 끌림 (스크롤과 구분)
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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

  function setEmoji(id: string, emoji: string | null) {
    updateHabit.mutate(
      { id, emoji },
      { onError: (e) => toast.push({ tone: "error", title: "이모지를 저장하지 못했습니다", description: e.message }) },
    );
  }

  /**
   * 오늘 보이는 활동끼리 순서를 바꾸면, 전체 목록에서 그 활동들이 있던 자리에
   * 새 순서대로 다시 끼워 넣는다 (다른 요일 활동의 위치는 그대로).
   */
  function onDragEnd({ active: from, over }: DragEndEvent) {
    if (!over || from.id === over.id) return;
    const ids = habits.map((h) => h.id);
    const moved = arrayMove(ids, ids.indexOf(String(from.id)), ids.indexOf(String(over.id)));
    const visible = new Set(ids);
    let k = 0;
    const next = all.map((h) => (visible.has(h.id) ? moved[k++] : h.id));
    reorder.mutate(next, {
      onError: (e) => toast.push({ tone: "error", title: "순서를 저장하지 못했습니다", description: e.message }),
    });
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
          <p className="text-caption text-muted">오늘은 예정된 활동이 없어요. 쉬어 가는 날입니다.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
            <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {habits.map((h) => (
                  <HabitItem
                    key={h.id}
                    habit={h}
                    on={done.has(h.id)}
                    onToggle={() => toggle(h.id)}
                    onEmoji={(e) => setEmoji(h.id, e)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </CardBody>
    </Card>
  );
}

function HabitItem({
  habit: h,
  on,
  onToggle,
  onEmoji,
}: {
  habit: HabitRow;
  on: boolean;
  onToggle: () => void;
  onEmoji: (emoji: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: h.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative flex items-center gap-1 rounded-md pr-1.5 transition-[background-color,box-shadow]",
        isDragging ? "z-10 bg-surface shadow-md ring-1 ring-border" : "hover:bg-surface-2",
      )}
    >
      {/* 손잡이: 끌어서 순서 바꾸기 */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`${h.name} 순서 바꾸기`}
        className={cn(
          "flex h-9 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-subtle transition-opacity active:cursor-grabbing",
          "opacity-40 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60",
          isDragging && "opacity-100",
        )}
      >
        <GripVertical className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        aria-label={`${h.name} ${on ? "완료 취소" : "완료"}`}
        className="flex h-9 shrink-0 items-center px-1"
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-[6px] border transition-colors",
            on ? "border-transparent bg-accent text-accent-foreground" : "border-border-strong bg-surface",
          )}
        >
          {on && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>

      <EmojiPicker value={h.emoji} onChange={onEmoji} size="sm" />

      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-hidden
        className={cn(
          "min-w-0 flex-1 truncate py-2 pl-1 text-left text-body",
          on && "text-muted line-through decoration-border-strong",
        )}
      >
        {h.name}
      </button>
    </li>
  );
}
