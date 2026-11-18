"use client";

import * as React from "react";
import { BookOpen, Plus, Search, Sparkles } from "lucide-react";
import {
  ZH_VOCAB_KINDS,
  ZH_VOCAB_KIND_LABEL,
  ZH_VOCAB_MAX_INPUT,
  type ZhVocabKind,
} from "@/lib/constants";
import type { ZhVocabRow } from "@/lib/types";
import { useAddZhVocab } from "@/lib/query/hooks";
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
  pinyinToggle,
  aiAvailable,
}: {
  items: ZhVocabRow[];
  showPinyin: boolean;
  pinyinToggle: React.ReactNode;
  aiAvailable: boolean;
}) {
  const toast = useToast();
  const add = useAddZhVocab();
  const [text, setText] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const cardRefs = React.useRef(new Map<string, HTMLElement>());

  const trimmed = text.trim();

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!trimmed || add.isPending) return;
    add.mutate(
      { text: trimmed },
      {
        onSuccess: (res) => {
          setText("");
          setFilter("all");
          setQ("");
          setFocusId(res.item.id);
          if (res.duplicate) {
            toast.push({ tone: "info", title: "이미 단어장에 있는 항목이에요", description: res.item.hanzi });
            // 목록이 다시 그려진 뒤 그 카드로 이동
            requestAnimationFrame(() =>
              cardRefs.current.get(res.item.id)?.scrollIntoView({ behavior: "smooth", block: "center" }),
            );
          }
        },
        onError: (err) => toast.push({ tone: "error", title: "카드를 만들지 못했습니다", description: err.message }),
      },
    );
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={ZH_VOCAB_MAX_INPUT}
              disabled={add.isPending}
              placeholder="단어·숙어·문장 입력 (예: 来得及, 马马虎虎, 여유가 없다)"
              className="h-11 text-[1.0625rem]"
            />
            <Button type="submit" size="lg" className="h-11" disabled={!trimmed || !aiAvailable} loading={add.isPending}>
              <Plus className="size-4" /> 추가
            </Button>
          </form>
          <p className="flex items-center gap-1.5 text-caption text-subtle">
            <Sparkles className="size-3.5 text-accent" />
            중국어나 한국어로 넣으면 AI가 병음, 뜻, 해석, 예문 3개를 만들어 함께 저장합니다.
          </p>
          {!aiAvailable && (
            <p className="text-caption text-warning">OPENAI_API_KEY 가 설정되지 않아 카드를 만들 수 없습니다.</p>
          )}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <SectionTitle action={pinyinToggle}>{`단어장 ${items.length}`}</SectionTitle>

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

        {add.isPending && (
          <div className="surface-card space-y-3 px-5 py-5" aria-busy>
            <p className="flex items-center gap-2 text-caption text-muted">
              <Sparkles className="size-4 animate-pulse-soft text-accent" />
              “{add.variables?.text}” 카드를 만드는 중…
            </p>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        )}

        {items.length === 0 && !add.isPending ? (
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
