import { addDaysKey } from "@/lib/utils";

/** 급수별 출제 기준. 지금은 6급만 연다 */
export const HSK_LEVEL_SPEC = {
  6: {
    label: "6급",
    /** 1부분: 단어 빈칸 */
    passage: [350, 500] as const,
    blanks: 5,
    /** 2부분: 문장 빈칸 (빈칸 문장을 뺀 지문 길이), 보기는 빈칸 + 1 */
    passage2: [220, 360] as const,
  },
} as const;

/** 독해 부분 (HSK 3.0 기준 번호) */
export const HSK_PARTS = {
  1: { label: "빈칸 채우기", short: "1부분", desc: "지문 속 빈칸에 알맞은 단어를 보기 4개 중에서", unit: "단어" },
  2: { label: "문장 고르기", short: "2부분", desc: "빈칸 5개에 알맞은 문장을 보기 6개(A~F) 중에서, 1개는 남아요", unit: "문장" },
} as const;
export type HskPart = keyof typeof HSK_PARTS;
export const HSK_PART_LIST = [1, 2] as const;
export type HskLevel = keyof typeof HSK_LEVEL_SPEC;
export const HSK_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export const HSK_OPEN_LEVELS: readonly number[] = [6];

export const HSK_TOPICS = ["일상", "직장", "과학", "문화", "역사", "사회", "건강", "환경", "경제", "인물"] as const;
export type HskTopic = (typeof HSK_TOPICS)[number];

export const HSK_KIND_LABEL = { collocation: "호응", idiom: "성어", connective: "접속·부사", sentence: "문장" } as const;

/** 풀에 이만큼은 미리 만들어 둔다 */
export const HSK_POOL_TARGET = 2;

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/** 지문을 글과 빈칸으로 나눈다: "…{{1}}…" → ["…", 1, "…"] */
export function splitPassage(passage: string): Array<string | number> {
  return passage.split(/\{\{(\d+)\}\}/).map((part, i) => (i % 2 ? Number(part) : part));
}

/** 빈칸이 들어 있는 문장 (단어장 문맥용), 빈칸 자리는 정답 단어로 */
export function sentenceWithBlank(passage: string, no: number, fill: (n: number) => string) {
  const filled = passage.replace(/\{\{(\d+)\}\}/g, (_m, n) => fill(Number(n)));
  const marker = fill(no);
  const sentences = filled.split(/(?<=[。！？；])/);
  return sentences.find((s) => s.includes(marker))?.trim() ?? filled.slice(0, 120);
}

/* 오답노트 복습: 맞히면 내일 → 3일 → 1주, 세 번 맞히면 해결. 틀리면 처음부터 */
export const WRONG_INTERVALS = [1, 3, 7] as const;

export function nextWrongState(
  cur: { stage: number; review_count: number },
  correct: boolean,
  today: string,
): { stage: number; due_on: string | null; review_count: number; resolved_at: string | null } {
  if (!correct) {
    return { stage: 0, due_on: addDaysKey(today, 1), review_count: cur.review_count + 1, resolved_at: null };
  }
  const stage = cur.stage + 1;
  if (stage >= WRONG_INTERVALS.length) {
    return { stage, due_on: null, review_count: cur.review_count + 1, resolved_at: new Date().toISOString() };
  }
  return { stage, due_on: addDaysKey(today, WRONG_INTERVALS[stage]), review_count: cur.review_count + 1, resolved_at: null };
}
