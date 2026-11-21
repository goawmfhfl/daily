import { addDaysKey } from "@/lib/utils";

/**
 * 단어장 복습 규칙 (서버·클라이언트가 같은 함수로 계산해 낙관적 업데이트와 결과가 같다).
 * 시험 없이 스스로 "외웠어요 / 아직"을 체크하면 다음 복습 날짜가 정해진다.
 */

/** 외움 단계별 다음 복습까지의 일수. stage 1 → 1일 … stage 6 → 90일 */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 90] as const;
export const MASTERED_STAGE = 7;
/** 한 번에 새로 외울 단어 수 (복습·외우는 중은 제한 없음) */
export const NEW_PER_SESSION = 20;

export type ReviewAction = "know" | "again" | "reset" | "master";
export const REVIEW_ACTIONS = ["know", "again", "reset", "master"] as const;

export interface ReviewFields {
  stage: number;
  due_on: string | null;
  review_count: number;
  last_reviewed_at: string | null;
}

export function applyReview(cur: ReviewFields, action: ReviewAction, today: string, now = new Date()): ReviewFields {
  const at = now.toISOString();
  switch (action) {
    case "know": {
      const stage = Math.min(cur.stage + 1, MASTERED_STAGE);
      return {
        stage,
        due_on: stage >= MASTERED_STAGE ? null : addDaysKey(today, REVIEW_INTERVALS[stage - 1]),
        review_count: cur.review_count + 1,
        last_reviewed_at: at,
      };
    }
    case "again":
      // 아직이면 처음 단계로. 오늘 외울 목록에 남아 다시 나온다
      return { stage: 0, due_on: today, review_count: cur.review_count + 1, last_reviewed_at: at };
    case "master":
      return { stage: MASTERED_STAGE, due_on: null, review_count: cur.review_count, last_reviewed_at: at };
    case "reset":
      return { stage: 0, due_on: null, review_count: 0, last_reviewed_at: null };
  }
}

export type VocabStatus = "new" | "learning" | "due" | "scheduled" | "mastered";

export function vocabStatus(v: ReviewFields, today: string): VocabStatus {
  if (v.stage >= MASTERED_STAGE) return "mastered";
  if (v.stage === 0) return v.review_count === 0 ? "new" : "learning";
  return v.due_on && v.due_on <= today ? "due" : "scheduled";
}

export const STATUS_META: Record<VocabStatus, { label: string; short: string; tone: string; bar: string }> = {
  new: { label: "외우지 않음", short: "새 단어", tone: "bg-surface-2 text-muted", bar: "var(--fg-subtle)" },
  learning: { label: "외우는 중", short: "외우는 중", tone: "bg-warning-soft text-warning", bar: "var(--warning)" },
  due: { label: "복습할 때", short: "오늘 복습", tone: "bg-accent-soft text-accent", bar: "var(--accent)" },
  scheduled: { label: "외움", short: "외움", tone: "bg-success-soft text-success", bar: "var(--success)" },
  mastered: { label: "완전히 외움", short: "완전히 외움", tone: "bg-primary text-primary-foreground", bar: "var(--primary)" },
};

/** 오늘 외울 목록에 들어가는지 */
export function isStudyToday(status: VocabStatus) {
  return status === "new" || status === "learning" || status === "due";
}

export function intervalLabel(days: number) {
  if (days === 1) return "내일";
  if (days < 7) return `${days}일 뒤`;
  if (days < 30) return days % 7 === 0 ? `${days / 7}주 뒤` : `${days}일 뒤`;
  return `${Math.round(days / 30)}달 뒤`;
}

/** "외웠어요"를 누르면 언제 다시 나오는지 */
export function nextKnowLabel(stage: number) {
  const next = Math.min(stage + 1, MASTERED_STAGE);
  return next >= MASTERED_STAGE ? "완전히 외움" : intervalLabel(REVIEW_INTERVALS[next - 1]);
}

/** 예정된 복습 날짜까지 남은 말 */
export function dueLabel(dueOn: string | null, today: string) {
  if (!dueOn) return "";
  const days = Math.round((Date.parse(dueOn) - Date.parse(today)) / 86_400_000);
  if (days <= 0) return "오늘 복습";
  return `${intervalLabel(days)} 복습`;
}
