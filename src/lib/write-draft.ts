import type { DialogueDraft } from "@/components/write/dialogue-composer";

/**
 * 기록 화면의 작성 중 초안을 이 브라우저(localStorage)에 보관한다.
 * 다른 탭에 다녀오거나 새로고침·창을 닫아도 쓰던 글이 남는다.
 * - 사용자별로 키를 나눠 같은 기기의 다른 계정과 섞이지 않게 한다
 * - 저장에 성공하면 지우고, 로그아웃할 때 모두 지운다
 * - 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 넘어간다
 */
export interface WriteDraft {
  mode: "free" | "dialogue";
  content: string;
  dialogue: DialogueDraft;
}

const PREFIX = "daily:write-draft:";

export function isDraftEmpty(d: WriteDraft) {
  return (
    !d.content.trim() &&
    d.dialogue.lines.length === 0 &&
    !d.dialogue.drafts.a.trim() &&
    !d.dialogue.drafts.b.trim()
  );
}

export function loadDraft(userId: string): WriteDraft | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<WriteDraft>;
    if (
      (d.mode !== "free" && d.mode !== "dialogue") ||
      typeof d.content !== "string" ||
      !d.dialogue ||
      !Array.isArray(d.dialogue.lines) ||
      typeof d.dialogue.drafts?.a !== "string" ||
      typeof d.dialogue.drafts?.b !== "string"
    ) {
      return null;
    }
    return { mode: d.mode, content: d.content, dialogue: d.dialogue as WriteDraft["dialogue"] };
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, d: WriteDraft) {
  try {
    if (isDraftEmpty(d)) window.localStorage.removeItem(PREFIX + userId);
    else window.localStorage.setItem(PREFIX + userId, JSON.stringify(d));
  } catch {
    // 용량 초과·차단 등은 무시 (초안 보관은 편의 기능)
  }
}

export function clearDraft(userId: string) {
  try {
    window.localStorage.removeItem(PREFIX + userId);
  } catch {
    // 무시
  }
}

/** 로그아웃 시: 이 기기에 남은 모든 계정의 초안 삭제 */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // 무시
  }
}
