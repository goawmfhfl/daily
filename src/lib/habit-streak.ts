import { addDaysKey, isHabitDay } from "@/lib/utils";

/**
 * 어제까지 이어 온 연속 일수: 그 활동을 하기로 한 요일만 세고, 쉬는 요일은 건너뛴다.
 * 오늘은 아직 끝나지 않았으므로 빼고, 화면에서 오늘 체크하면 +1 한다.
 */
export function streakBefore(
  habit: { started_at: string; weekdays?: number[] | null },
  done: Set<string>,
  today: string,
): number {
  let n = 0;
  let d = addDaysKey(today, -1);
  for (let i = 0; i < 1500 && d >= habit.started_at; i++, d = addDaysKey(d, -1)) {
    if (!isHabitDay(habit, d)) continue;
    if (!done.has(d)) break;
    n++;
  }
  return n;
}
