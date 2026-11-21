"use client";

import * as React from "react";
import { AlertCircle, BookOpen, Plus, RotateCw, Search, Sparkles, X } from "lucide-react";
import {
  ZH_VOCAB_KINDS,
  ZH_VOCAB_KIND_LABEL,
  ZH_VOCAB_MAX_INPUT,
  type ZhVocabKind,
} from "@/lib/constants";
import type { ZhVocabRow } from "@/lib/types";
import {
  useAddZhVocab,
  useDismissZhVocabJob,
  useZhVocabJobs,
  type ZhVocabJob,
} from "@/lib/query/hooks";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { VocabCard } from "./vocab-card";

type Filter = "all" | ZhVocabKind;

export function VocabPanel({
  items,
  showPinyin,
  hide,
  pinyinToggle,
  aiAvailable,
}: {
  items: ZhVocabRow[];
  showPinyin: boolean;
  /** 뜻만 보고 중국어 떠올리기 */
  hide: boolean;
  pinyinToggle: React.ReactNode;
  aiAvailable: boolean;
}) {
  const toast = useToast();
  const add = useAddZhVocab();
  const jobs = useZhVocabJobs();
  const dismiss = useDismissZhVocabJob();
  const [text, setText] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  /** 중복 입력으로 찾아간 카드 (언제 찾아갔는지와 함께) */
  const [jump, setJump] = React.useState<{ id: string; at: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cardRefs = React.useRef(new Map<string, HTMLElement>());

  const trimmed = text.trim();
  // 진행 중·실패한 요청은 위에 카드로, 최근 것이 위로
  const active = React.useMemo(
    () =>
      jobs
        .filter((j) => j.status === "pending" || j.status === "error")
        .sort((a, b) => b.submittedAt - a.submittedAt),
    [jobs],
  );
  const pendingCount = active.filter((j) => j.status === "pending").length;

  // 가장 최근 사건(새로 완성된 카드 또는 중복으로 찾아간 카드)을 강조
  const focusId = React.useMemo(() => {
    const done = jobs
      .filter((j) => j.status === "success" && j.itemId && !j.duplicate)
      .sort((a, b) => b.submittedAt - a.submittedAt)[0];
    if (jump && (!done || jump.at > done.submittedAt)) return jump.id;
    return done?.itemId ?? null;
  }, [jobs, jump]);

  function goTo(id: string) {
    setFilter("all");
    setQ("");
    setJump({ id, at: Date.now() });
    requestAnimationFrame(() =>
      cardRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  /**
   * 보내자마자 입력창을 비워 다음 단어를 바로 쓸 수 있게 한다.
   * 이미 있거나 만드는 중인 항목은 요청을 보내지 않는다.
   */
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!trimmed) return;
    const existing = items.find((v) => v.hanzi === trimmed || v.input === trimmed);
    if (existing) {
      toast.push({ tone: "info", title: "이미 단어장에 있는 항목이에요", description: existing.hanzi });
      setText("");
      goTo(existing.id);
      return;
    }
    if (active.some((j) => j.status === "pending" && j.text === trimmed)) {
      toast.push({ tone: "info", title: "지금 만드는 중이에요", description: trimmed });
      setText("");
      return;
    }
    add.mutate({ text: trimmed });
    setText("");
    inputRef.current?.focus();
  }

  function retry(job: ZhVocabJob) {
    dismiss(job.mutationId);
    add.mutate({ text: job.text, context: job.context });
  }

  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, word: 0, idiom: 0, sentence: 0 };
    for (const v of items) c[v.kind] += 1;
    return c;
  }, [items]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((v) => {
      if (filter !== "all" && v.kind !== filter) return false;
      if (!needle) return true;
      return (
        v.hanzi.includes(needle) ||
        v.pinyin.toLowerCase().includes(needle) ||
        v.meaning.toLowerCase().includes(needle) ||
        v.input.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, q]);

  return (
    <div className="space-y-8">
      <Card>
        <CardBody className="space-y-3">
          <form onSubmit={submit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter 는 글자 확정용이라 보내지 않는다
                if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
              }}
              maxLength={ZH_VOCAB_MAX_INPUT}
              enterKeyHint="send"
              placeholder="단어·숙어·문장 입력 (예: 来得及, 马马虎虎, 여유가 없다)"
              className="h-11 text-[1.0625rem]"
            />
            <Button type="submit" size="lg" className="h-11" disabled={!trimmed || !aiAvailable}>
              <Plus className="size-4" /> 추가
            </Button>
          </form>
          <p className="flex items-center gap-1.5 text-caption text-subtle">
            <Sparkles className="size-3.5 text-accent" />
            중국어나 한국어로 넣으면 AI가 병음, 뜻, 해석, 예문 3개를 만들어 함께 저장합니다. 기다리지 않고 계속 넣어도 됩니다.
          </p>
          {!aiAvailable && (
            <p className="text-caption text-warning">OPENAI_API_KEY 가 설정되지 않아 카드를 만들 수 없습니다.</p>
          )}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <SectionTitle action={pinyinToggle}>
          {`단어장 ${items.length}`}
          {pendingCount > 0 && (
            <span className="ml-2 normal-case tracking-normal text-accent">· {pendingCount}개 만드는 중</span>
          )}
        </SectionTitle>

        {items.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `전체 ${counts.all}` },
                ...ZH_VOCAB_KINDS.map((k) => ({ value: k, label: `${ZH_VOCAB_KIND_LABEL[k]} ${counts[k]}` })),
              ]}
            />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="한자, 병음, 뜻으로 찾기"
                className="pl-9"
              />
            </div>
          </div>
        )}

        {active.length > 0 && (
          <ul className="space-y-2">
            {active.map((j) => (
              <li key={j.mutationId}>
                <JobCard job={j} onRetry={() => retry(j)} onDismiss={() => dismiss(j.mutationId)} />
              </li>
            ))}
          </ul>
        )}

        {items.length === 0 && active.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title="단어장이 비어 있습니다"
            description="외우고 싶은 단어나 숙어를 위에 넣어 보세요. 번역 탭에서 단어를 눌러 바로 추가할 수도 있습니다."
          />
        ) : filtered.length === 0 && items.length > 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong/70 px-4 py-8 text-center text-caption text-muted">
            조건에 맞는 항목이 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((v) => (
              <li key={v.id}>
                <VocabCard
                  ref={(el) => {
                    if (el) cardRefs.current.set(v.id, el);
                    else cardRefs.current.delete(v.id);
                  }}
                  item={v}
                  showPinyin={showPinyin}
                  hide={hide}
                  highlight={v.id === focusId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 만드는 중이거나 실패한 요청 하나 */
function JobCard({
  job,
  onRetry,
  onDismiss,
}: {
  job: ZhVocabJob;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (job.status === "error") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft/50 px-4 py-3 animate-fade-in">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold">
            <span lang="zh-CN">“{job.text}”</span> 카드를 만들지 못했습니다
          </p>
          {job.error && <p className="mt-0.5 text-caption text-muted">{job.error}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> 다시 시도
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="닫기"
          className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="surface-card flex items-center gap-3 px-4 py-3 animate-fade-in" aria-busy>
      <Spinner className="size-4 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium">
          <span lang="zh-CN">{job.text}</span>
        </p>
        <p className="text-micro text-subtle">병음 · 뜻 · 예문 만드는 중</p>
      </div>
      <div className="hidden w-28 space-y-1.5 sm:block" aria-hidden>
        <Skeleton className="h-2" />
        <Skeleton className="h-2 w-2/3" />
      </div>
    </div>
  );
}
