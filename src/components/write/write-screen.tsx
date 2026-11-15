"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, PenLine, Sparkles } from "lucide-react";
import {
  AI_MODES,
  AI_MODE_META,
  type AiMode,
  type UserSettings,
} from "@/lib/constants";
import type {
  EntryRow,
  HabitRow,
  HabitCheckRow,
  TagSuggestion,
} from "@/lib/types";
import { api } from "@/lib/api";
import { formatDateKo, todayKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TagConfirm, type ConfirmedTag } from "./tag-confirm";
import { HabitChecklist } from "./habit-checklist";
import { DialogueComposer } from "./dialogue-composer";

type Phase = "idle" | "saving" | "confirm";

interface SaveResponse {
  entry: EntryRow;
  crisis: boolean;
  suggestion: TagSuggestion | null;
  ai_error?: string | null;
}

export function WriteScreen({
  today,
  settings,
  habits,
  todayChecks,
  aiAvailable,
  recent,
}: {
  today: string;
  settings: UserSettings;
  habits: HabitRow[];
  todayChecks: HabitCheckRow[];
  aiAvailable: boolean;
  recent: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = React.useState<"free" | "dialogue">(settings.default_mode);
  const [aiMode, setAiMode] = React.useState<AiMode>(settings.default_ai_mode);
  const [content, setContent] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [saved, setSaved] = React.useState<SaveResponse | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 서버 렌더는 Asia/Seoul 기준 today, 클라이언트에서는 기기 날짜(자정 넘김 대응)
  const dateKey = React.useSyncExternalStore(
    subscribeNoop,
    () => todayKey(),
    () => today,
  );

  async function save(text: string, entryMode: "free" | "dialogue") {
    if (!text.trim()) return;
    setPhase("saving");
    try {
      const res = await api<SaveResponse>("/api/entries", {
        method: "POST",
        body: { content: text, mode: entryMode, entry_date: dateKey, ai_mode: aiMode },
      });
      if (res.crisis) {
        router.push(`/safety?entry=${res.entry.id}`);
        return;
      }
      setSaved(res);
      setContent("");
      if (res.suggestion) {
        setPhase("confirm");
      } else {
        setPhase("idle");
        toast.push({
          tone: "success",
          title: "기록이 저장되었습니다",
          description: res.ai_error ?? undefined,
        });
        router.refresh();
      }
    } catch (e) {
      setPhase("idle");
      toast.push({
        tone: "error",
        title: "저장하지 못했습니다",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function confirmTags(tags: ConfirmedTag[]) {
    if (!saved) return;
    try {
      await api(`/api/entries/${saved.entry.id}/tags`, {
        method: "PUT",
        body: { tags },
      });
      toast.push({ tone: "success", title: "태그가 저장되었습니다" });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "태그 저장 실패",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPhase("idle");
      setSaved(null);
      router.refresh();
      textareaRef.current?.focus();
    }
  }

  function skipTags() {
    setPhase("idle");
    setSaved(null);
    router.refresh();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void save(content, "free");
    }
  }

  const composerDisabled = phase !== "idle";

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
      {/* 왼쪽: 최근 기록 (데스크톱) */}
      <div className="order-3 lg:order-1">{recent}</div>

      {/* 가운데: 입력 */}
      <section className="order-1 min-w-0 lg:order-2">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-caption font-medium text-accent">
              {formatDateKo(dateKey, "yyyy년 M월 d일 EEEE")}
            </p>
            <h1 className="mt-0.5 text-title font-semibold tracking-tight sm:text-display">
              오늘은 어떤 하루였나요
            </h1>
          </div>
          <Segmented<"free" | "dialogue">
            value={mode}
            onChange={(v) => {
              if (phase !== "idle") return;
              setMode(v);
            }}
            options={[
              { value: "free", label: "자유 메모", icon: <PenLine className="size-4" /> },
              { value: "dialogue", label: "대화형", icon: <MessageCircle className="size-4" /> },
            ]}
          />
        </div>

        <Card className="overflow-hidden">
          {mode === "free" ? (
            <CardBody className="p-0">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={composerDisabled}
                placeholder="아무렇게나 적어도 괜찮습니다. 감정, 사건, 상황은 저장 후 AI가 태그로 제안합니다."
                className="min-h-[220px] rounded-none border-0 bg-transparent px-5 py-5 text-[1.0625rem] leading-[1.75] shadow-none focus:ring-0 sm:min-h-[280px]"
                autoFocus
              />
              <div className="flex flex-col gap-3 border-t border-border bg-surface-2/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <AiModeChips value={aiMode} onChange={setAiMode} disabled={composerDisabled} />
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-micro text-subtle">
                    {content.length > 0 ? `${content.length}자 · ` : ""}⌘/Ctrl + Enter
                  </span>
                  <Button
                    onClick={() => save(content, "free")}
                    disabled={!content.trim() || composerDisabled}
                    loading={phase === "saving"}
                  >
                    저장
                  </Button>
                </div>
              </div>
            </CardBody>
          ) : (
            <DialogueComposer
              aiMode={aiMode}
              onAiModeChange={setAiMode}
              aiAvailable={aiAvailable}
              saving={phase === "saving"}
              onSave={(text) => save(text, "dialogue")}
            />
          )}
        </Card>

        {!aiAvailable && (
          <p className="mt-3 text-caption text-warning">
            OPENAI_API_KEY 가 설정되지 않아 저장은 되지만 태그 제안과 AI 응답은 생략됩니다.
          </p>
        )}

        {/* 모바일: 저장 후 확인 패널을 입력창 바로 아래에 */}
        <div className="mt-6 space-y-6 lg:hidden">
          <AfterSave saved={saved} phase={phase} onConfirm={confirmTags} onSkip={skipTags} />
        </div>
      </section>

      {/* 오른쪽: AI 응답 + 태그 확인 + 지속 활동 */}
      <aside className="order-2 space-y-6 lg:order-3">
        <div className="hidden space-y-6 lg:block">
          <AfterSave saved={saved} phase={phase} onConfirm={confirmTags} onSkip={skipTags} />
        </div>
        <HabitChecklist habits={habits} initialChecks={todayChecks} dateKey={dateKey} />
      </aside>
    </div>
  );
}

function subscribeNoop() {
  return () => {};
}

function AiModeChips({
  value,
  onChange,
  disabled,
}: {
  value: AiMode;
  onChange: (m: AiMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Sparkles className="mr-0.5 size-3.5 text-subtle" />
      {AI_MODES.map((m) => (
        <Chip
          key={m}
          size="sm"
          selected={value === m}
          onClick={() => !disabled && onChange(m)}
          title={AI_MODE_META[m].description}
        >
          {AI_MODE_META[m].label}
        </Chip>
      ))}
    </div>
  );
}

function AfterSave({
  saved,
  phase,
  onConfirm,
  onSkip,
}: {
  saved: SaveResponse | null;
  phase: Phase;
  onConfirm: (tags: ConfirmedTag[]) => void;
  onSkip: () => void;
}) {
  if (phase === "saving") {
    return (
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2 text-caption text-muted">
            <Sparkles className="size-4 animate-pulse-soft text-accent" />
            저장하고 태그를 제안하는 중…
          </div>
          <div className="space-y-2">
            <div className="h-3 w-4/5 animate-pulse-soft rounded bg-surface-3" />
            <div className="h-3 w-3/5 animate-pulse-soft rounded bg-surface-3" />
          </div>
        </CardBody>
      </Card>
    );
  }
  if (phase !== "confirm" || !saved?.suggestion) return null;
  return (
    <>
      <Card className="animate-fade-up border-accent/30 bg-accent-soft/40">
        <CardBody className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="accent">AI</Badge>
            <span className="text-micro text-muted">
              {AI_MODE_META[saved.entry.ai_mode ?? "comfort"].label} 모드
            </span>
          </div>
          <p className="text-body leading-relaxed">{saved.suggestion.reply}</p>
        </CardBody>
      </Card>
      <TagConfirm suggestion={saved.suggestion} onConfirm={onConfirm} onSkip={onSkip} />
    </>
  );
}
