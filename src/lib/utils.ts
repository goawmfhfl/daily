import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { format, parseISO, differenceInCalendarDays, startOfWeek, addDays } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * 커스텀 타이포 스케일(text-body 등)을 font-size 그룹으로 등록.
 * 등록하지 않으면 tailwind-merge 가 색상 클래스로 오인해 text-{color} 를 지운다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "title", "heading", "body", "caption", "micro"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 날짜를 로컬 기준 yyyy-MM-dd 로 */
export function todayKey(d: Date = new Date()) {
  return format(d, "yyyy-MM-dd");
}

export function formatDateKo(iso: string, pattern = "M월 d일 (EEE)") {
  try {
    return format(parseISO(iso), pattern, { locale: ko });
  } catch {
    return iso;
  }
}

export function formatDateTimeKo(iso: string) {
  try {
    return format(new Date(iso), "yyyy.MM.dd HH:mm", { locale: ko });
  } catch {
    return iso;
  }
}

export function relativeDayLabel(dateKey: string, today = todayKey()) {
  const diff = differenceInCalendarDays(parseISO(today), parseISO(dateKey));
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  return formatDateKo(dateKey, "M월 d일");
}

export function truncate(text: string, max = 80) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** 연속 기록일 계산. dateKeys는 중복 가능, 순서 무관 */
export function computeStreak(dateKeys: string[], today = todayKey()) {
  const set = new Set(dateKeys);
  if (set.size === 0) return 0;
  let cursor = parseISO(today);
  // 오늘 아직 안 썼으면 어제부터 센다
  if (!set.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = new Date(cursor.getTime() - 86400000);
    if (!set.has(format(cursor, "yyyy-MM-dd"))) return 0;
  }
  let streak = 0;
  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
) {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/* ───────── 활동 요일 ───────── */

/** yyyy-MM-dd 의 요일 번호 (0=일 … 6=토) */
export function weekdayOf(dateKey: string) {
  return parseISO(dateKey).getDay();
}

/** 이 활동을 그날 해야 하는지 */
export function isHabitDay(habit: { weekdays?: number[] | null }, dateKey: string) {
  const days = habit.weekdays?.length ? habit.weekdays : [0, 1, 2, 3, 4, 5, 6];
  return days.includes(weekdayOf(dateKey));
}

/** from~to(포함) 사이에서 그 활동을 해야 했던 날짜 목록 */
export function habitDaysBetween(habit: { weekdays?: number[] | null }, from: string, to: string) {
  const out: string[] = [];
  if (from > to) return out;
  let d = parseISO(from);
  const end = parseISO(to);
  while (d <= end) {
    const key = format(d, "yyyy-MM-dd");
    if (isHabitDay(habit, key)) out.push(key);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
}

/** "매일" / "평일" / "주말" / "월·수·금" */
export function weekdaysLabel(days?: number[] | null) {
  const set = new Set(days?.length ? days : [0, 1, 2, 3, 4, 5, 6]);
  if (set.size === 7) return "매일";
  const weekday = [1, 2, 3, 4, 5].every((d) => set.has(d));
  if (set.size === 5 && weekday) return "평일";
  if (set.size === 2 && set.has(0) && set.has(6)) return "주말";
  const label = ["일", "월", "화", "수", "목", "금", "토"];
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.has(d)).map((d) => label[d]).join("·");
}

/** 그 날짜가 속한 주의 월요일 (yyyy-MM-dd) */
export function weekStartKey(dateKey: string) {
  return format(startOfWeek(parseISO(dateKey), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** yyyy-MM-dd 에 n일 더하기 */
export function addDaysKey(dateKey: string, n: number) {
  return format(addDays(parseISO(dateKey), n), "yyyy-MM-dd");
}
