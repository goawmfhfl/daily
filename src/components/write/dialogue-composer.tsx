"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, RotateCcw, Sparkles } from "lucide-react";
import { AI_MODES, AI_MODE_META, DIALOGUE_MAX_TURNS, type AiMode } from "@/lib/constants";
import type { DialogueMessage } from "@/lib/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";

const OPENERS = [
  "오늘 가장 마음에 남은 순간은 무엇이었나요?",
  "지금 몸의 상태를 한 단어로 말하면 무엇인가요? 그 이유도 궁금합니다.",
  "오늘 하루 중 가장 에너지가 떨어진 때는 언제였나요?",
  "오늘 나를 조금이라도 웃게 한 일이 있었나요?",
  "지금 머릿속을 가장 많이 차지하는 생각은 무엇인가요?",
];

/**
 * 대화형 기록: AI가 짧은 질문을 던지고 사용자가 답한다.
 * 저장 시에는 사용자의 답변만 모아 하나의 기록으로 만든다 (AI 말은 분석 데이터에서 제외).
 */
export function DialogueComposer({
  aiMode,
  onAiModeChange,
  aiAvailable,
  saving,
  onSave,
}: {
  aiMode: AiMode;
  onAiModeChange: (m: AiMode) => void;
  aiAvailable: boolean;
  saving: boolean;
  onSave: (content: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = React.useState<DialogueMessage[]>(() => [
    { role: "assistant", content: OPENERS[Math.floor(Math.random() * OPENERS.length)] },
  ]);
  const [draft, setDraft] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const userTurns = messages.filter((m) => m.role === "user");
  const canAsk = aiAvailable && !done && userTurns.length < DIALOGUE_MAX_TURNS;

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking]);

  async function send() {
    const text = draft.trim();
    if (!text || thinking) return;
    const next: DialogueMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    if (!canAsk) {
      setDone(true);
      return;
    }
    setThinking(true);
    try {
      const res = await api<{ message: string | null; done: boolean; risk: boolean }>(
        "/api/dialogue",
        { method: "POST", body: { messages: next, ai_mode: aiMode } },
      );
      if (res.risk) {
        // 사람 우선: 대화를 멈추고 사용자의 답변만 저장한 뒤 안전 화면으로
        onSave(next.filter((m) => m.role === "user").map((m) => m.content).join("\n\n"));
        router.prefetch("/safety");
        return;
      }
      if (res.message) setMessages((m) => [...m, { role: "assistant", content: res.message! }]);
      if (res.done) setDone(true);
    } catch (e) {
      toast.push({ tone: "error", title: "질문을 가져오지 못했습니다", description: e instanceof Error ? e.message : undefined });
    } finally {
      setThinking(false);
    }
  }

  function reset() {
    setMessages([{ role: "assistant", content: OPENERS[Math.floor(Math.random() * OPENERS.length)] }]);
    setDraft("");
    setDone(false);
  }

  function save() {
    const content = userTurns.map((m) => m.content).join("\n\n");
    if (!content.trim()) return;
    onSave(content);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex min-h-[420px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex animate-fade-up",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-body leading-relaxed",
                m.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-surface-2 text-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3">
              <span className="size-1.5 animate-pulse-soft rounded-full bg-subtle" />
              <span className="size-1.5 animate-pulse-soft rounded-full bg-subtle [animation-delay:200ms]" />
              <span className="size-1.5 animate-pulse-soft rounded-full bg-subtle [animation-delay:400ms]" />
            </div>
          </div>
        )}
        {done && userTurns.length > 0 && (
          <p className="pt-2 text-center text-caption text-muted">
            대화가 끝났습니다. 아래에서 기록으로 저장하세요. (AI의 말은 저장되지 않습니다)
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-surface-2/50 px-4 py-3">
        {!done && (
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={aiAvailable ? "답을 적고 Enter" : "AI 키가 없어 질문은 이어지지 않습니다. 답만 적고 저장할 수 있습니다."}
              className="min-h-[44px] bg-surface"
              disabled={thinking || saving}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={send}
              disabled={!draft.trim() || thinking || saving}
              aria-label="보내기"
              className="h-10 w-10 shrink-0"
            >
              <CornerDownLeft className="size-4" />
            </Button>
          </div>
        )}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Sparkles className="mr-0.5 size-3.5 text-subtle" />
            {AI_MODES.map((m) => (
              <Chip key={m} size="sm" selected={aiMode === m} onClick={() => onAiModeChange(m)} title={AI_MODE_META[m].description}>
                {AI_MODE_META[m].label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="text-micro text-subtle">
              {userTurns.length}/{DIALOGUE_MAX_TURNS}
            </span>
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              <RotateCcw className="size-3.5" /> 다시
            </Button>
            <Button onClick={save} disabled={userTurns.length === 0 || saving} loading={saving}>
              기록으로 저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
