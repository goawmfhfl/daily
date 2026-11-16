"use client";

import * as React from "react";
import { CornerDownLeft, RotateCcw, Sparkles, X } from "lucide-react";
import { AI_MODES, AI_MODE_META, type AiMode } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";

type Speaker = "a" | "b";

interface Line {
  id: number;
  speaker: Speaker;
  text: string;
}

/** 작성 중인 셀프 대화. 모드를 바꿔도 사라지지 않도록 부모(WriteScreen)가 들고 있다 */
export interface DialogueDraft {
  lines: Line[];
  drafts: Record<Speaker, string>;
}

export const EMPTY_DIALOGUE: DialogueDraft = { lines: [], drafts: { a: "", b: "" } };

const DEFAULT_NAMES: Record<Speaker, string> = { a: "A", b: "B" };

/** 역할 예시: 누르면 두 화자의 이름이 바뀐다 */
const PRESETS: { a: string; b: string }[] = [
  { a: "지금의 나", b: "1년 뒤의 나" },
  { a: "나", b: "내 안의 비평가" },
  { a: "나", b: "가장 친한 친구" },
  { a: "불안한 나", b: "다독이는 나" },
];

const NAMES_KEY = "daily:self-dialogue-names";

function loadNames(): Record<Speaker, string> {
  try {
    const raw = window.localStorage.getItem(NAMES_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Record<Speaker, string>>;
      return { a: v.a ?? DEFAULT_NAMES.a, b: v.b ?? DEFAULT_NAMES.b };
    }
  } catch {
    // 저장소를 쓸 수 없는 환경이면 기본 이름
  }
  return DEFAULT_NAMES;
}

/**
 * 셀프 대화형 기록: 내가 A와 B 두 화자를 모두 맡아 스스로와 대화한다.
 * - A 입력란에서 Enter → A의 말로 추가되고 커서가 B로, B에서 Enter → 다시 A로
 * - Shift + Enter 는 줄바꿈
 * - 저장하면 "이름: 말" 형식의 대화 전체가 하나의 기록이 된다
 */
export function DialogueComposer({
  draft,
  onDraftChange,
  aiMode,
  onAiModeChange,
  saving,
  onSave,
}: {
  draft: DialogueDraft;
  onDraftChange: React.Dispatch<React.SetStateAction<DialogueDraft>>;
  aiMode: AiMode;
  onAiModeChange: (m: AiMode) => void;
  saving: boolean;
  /** 저장에 성공하면 true */
  onSave: (content: string) => Promise<boolean>;
}) {
  // 마지막에 쓴 역할 이름을 기억 (이 기기에서만). 이 화면은 브라우저에서만 그려진다
  const [names, setNames] = React.useState<Record<Speaker, string>>(loadNames);
  const { lines, drafts } = draft;
  const setLines = (u: React.SetStateAction<Line[]>) =>
    onDraftChange((d) => ({ ...d, lines: typeof u === "function" ? u(d.lines) : u }));
  const setDrafts = (u: React.SetStateAction<Record<Speaker, string>>) =>
    onDraftChange((d) => ({ ...d, drafts: typeof u === "function" ? u(d.drafts) : u }));
  const inputRefs = { a: React.useRef<HTMLTextAreaElement>(null), b: React.useRef<HTMLTextAreaElement>(null) };
  const bottomRef = React.useRef<HTMLDivElement>(null);

  function updateNames(next: Record<Speaker, string>) {
    setNames(next);
    try {
      window.localStorage.setItem(NAMES_KEY, JSON.stringify(next));
    } catch {
      // 무시
    }
  }

  React.useEffect(() => {
    if (lines.length) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines.length]);

  const nameOf = (s: Speaker) => names[s].trim() || DEFAULT_NAMES[s];
  const other = (s: Speaker): Speaker => (s === "a" ? "b" : "a");

  function send(speaker: Speaker) {
    const text = drafts[speaker].trim();
    if (!text || saving) return;
    setLines((prev) => [...prev, { id: Math.max(0, ...prev.map((l) => l.id)) + 1, speaker, text }]);
    setDrafts((d) => ({ ...d, [speaker]: "" }));
    // 상대 역할로 차례를 넘긴다
    inputRefs[other(speaker)].current?.focus();
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function reset() {
    if (lines.length && !window.confirm("지금까지 쓴 대화를 지우고 새로 시작할까요?")) return;
    setLines([]);
    setDrafts({ a: "", b: "" });
    inputRefs.a.current?.focus();
  }

  /** 입력란에 남아 있는 말도 함께 저장 */
  function transcript() {
    const pending = (["a", "b"] as const)
      .filter((s) => drafts[s].trim())
      .map((s) => ({ id: -1, speaker: s, text: drafts[s].trim() }));
    return [...lines, ...pending].map((l) => `${nameOf(l.speaker)}: ${l.text}`).join("\n\n");
  }

  async function save() {
    const content = transcript();
    if (!content.trim() || saving) return;
    // 저장에 성공했을 때만 비운다 (실패하면 쓴 대화를 그대로 둔다)
    if (await onSave(content)) {
      setLines([]);
      setDrafts({ a: "", b: "" });
    }
  }

  function onKeyDown(speaker: Speaker) {
    return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) void save();
        else send(speaker);
      }
    };
  }

  const hasContent = lines.length > 0 || !!drafts.a.trim() || !!drafts.b.trim();

  return (
    <div className="flex min-h-[420px] flex-col">
      <div className="flex-1 space-y-3 px-5 py-5">
        {lines.length === 0 ? (
          <div className="space-y-4 py-6 text-center">
            <div>
              <p className="text-body font-medium">두 사람이 되어 스스로와 대화해 보세요</p>
              <p className="mt-1 text-caption text-muted">
                A와 B를 모두 내가 맡습니다. 한쪽에서 Enter 를 누르면 차례가 상대에게 넘어가고, Shift + Enter 는 줄바꿈, ⌘/Ctrl + Enter 는 저장입니다.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {PRESETS.map((p) => (
                <Chip
                  key={`${p.a}-${p.b}`}
                  size="sm"
                  selected={names.a === p.a && names.b === p.b}
                  onClick={() => updateNames(p)}
                >
                  {p.a} · {p.b}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          lines.map((l) => (
            <div
              key={l.id}
              className={cn(
                "group flex animate-fade-up items-end gap-1.5",
                l.speaker === "b" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div className={cn("flex max-w-[85%] flex-col", l.speaker === "b" ? "items-end" : "items-start")}>
                <span className="mb-1 px-1 text-micro font-medium text-subtle">{nameOf(l.speaker)}</span>
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-body leading-relaxed",
                    l.speaker === "b"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-surface-2 text-foreground",
                  )}
                >
                  {l.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeLine(l.id)}
                disabled={saving}
                className="mb-1 rounded-sm p-1 text-subtle opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                aria-label="이 말 지우기"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2 border-t border-border bg-surface-2/50 px-4 py-3">
        {(["a", "b"] as const).map((s) => (
          <div key={s} className="flex items-start gap-2">
            <input
              value={names[s]}
              onChange={(e) => updateNames({ ...names, [s]: e.target.value })}
              maxLength={20}
              placeholder={DEFAULT_NAMES[s]}
              aria-label={`${DEFAULT_NAMES[s]} 화자 이름`}
              className={cn(
                "h-10 w-24 shrink-0 truncate rounded-md border px-2.5 text-caption font-semibold focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:w-28",
                s === "b"
                  ? "border-transparent bg-primary text-primary-foreground placeholder:text-primary-foreground/60"
                  : "border-border bg-surface text-foreground placeholder:text-subtle",
              )}
            />
            <Textarea
              ref={inputRefs[s]}
              value={drafts[s]}
              onChange={(e) => setDrafts((d) => ({ ...d, [s]: e.target.value }))}
              onKeyDown={onKeyDown(s)}
              rows={1}
              autoResize
              placeholder={`${nameOf(s)}의 말 · Enter`}
              className="min-h-10 bg-surface py-2"
              disabled={saving}
              autoFocus={s === "a"}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => send(s)}
              disabled={!drafts[s].trim() || saving}
              aria-label={`${nameOf(s)}의 말 추가`}
              className="h-10 w-10 shrink-0"
            >
              <CornerDownLeft className="size-4" />
            </Button>
          </div>
        ))}

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Sparkles className="mr-0.5 size-3.5 text-subtle" />
            {AI_MODES.map((m) => (
              <Chip key={m} size="sm" selected={aiMode === m} onClick={() => onAiModeChange(m)} title={AI_MODE_META[m].description}>
                {AI_MODE_META[m].label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="whitespace-nowrap text-micro text-subtle" title="⌘/Ctrl + Enter 로 바로 저장">{lines.length}마디</span>
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving || !hasContent}>
              <RotateCcw className="size-3.5" /> 다시
            </Button>
            <Button onClick={save} disabled={!hasContent || saving} loading={saving}>
              기록으로 저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
