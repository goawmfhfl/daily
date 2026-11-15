import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
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

/** 서버에서 쓰는 "오늘": 서버 타임존과 무관하게 Asia/Seoul 기준 */
export function todayKeySeoul(d: Date = new Date()) {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
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
