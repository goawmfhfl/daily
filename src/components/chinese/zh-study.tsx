"use client";

import * as React from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import type { ZhTranslationRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useZhPairs } from "@/lib/query/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { ZhSentence } from "./zh-sentence";

export type ZhView = "paragraph" | "sentences";

/**
 * 가림막: 가리기 모드에서는 중국어를 흐리게 덮고, 눌러야 보인다.
 * 흐린 모양으로 문장 길이만 짐작할 수 있게 남긴다.
 */
export function Cover({
  covered,
  onReveal,
  label = "떠올려 본 뒤 눌러서 확인",
  className,
  children,
}: {
  covered: boolean;
  onReveal: () => void;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden={covered || undefined}
        className={cn(
          "transition-[filter,opacity] duration-200",
          covered && "pointer-events-none select-none opacity-50 blur-[7px]",
        )}
      >
        {children}
      </div>
      {covered && (
        <button
          type="button"
          onClick={onReveal}
          className="group absolute inset-0 flex items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1 text-caption font-medium text-muted shadow-sm transition-colors group-hover:text-foreground">
            <Eye className="size-3.5" />
            {label}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * 카드 하나만 가리기: 위쪽 '중국어 가리기'를 따르다가, 카드에서 누르면 그 카드만 바뀐다.
 * 위쪽 설정을 다시 바꾸면 모든 카드가 그 설정으로 돌아간다.
 */
export function useCardHide(globalHide: boolean) {
  const [own, setOwn] = React.useState<boolean | null>(null);
  const [prevGlobal, setPrevGlobal] = React.useState(globalHide);
  if (prevGlobal !== globalHide) {
    setPrevGlobal(globalHide);
    setOwn(null);
  }
  const hide = own ?? globalHide;
  const toggle = React.useCallback(() => setOwn(!hide), [hide]);
  return [hide, toggle] as const;
}

/** 카드 머리의 가리기 버튼 */
export function CardHideToggle({ hide, onToggle, className }: { hide: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hide}
      aria-label={hide ? "이 카드 중국어 보이기" : "이 카드만 중국어 가리기"}
      title={hide ? "이 카드 중국어 보이기" : "이 카드만 중국어 가리기"}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        hide ? "bg-accent-soft text-accent" : "text-subtle hover:bg-surface-2 hover:text-foreground",
        className,
      )}
    >
      <EyeOff className="size-3.5" />
    </button>
  );
}

/** 혼자 열고 닫는 가림막 (가리기 모드가 바뀌면 부모가 key 로 초기화) */
export function SelfCover({ hide, ...rest }: { hide: boolean } & Omit<React.ComponentProps<typeof Cover>, "covered" | "onReveal">) {
  const [revealed, setRevealed] = React.useState(false);
  return <Cover covered={hide && !revealed} onReveal={() => setRevealed(true)} {...rest} />;
}

/** 번역 카드 본문: 문단 통째로 또는 한 문장씩, 가리기 연습 포함 */
export function ZhStudy({
  translation,
  view,
  hide,
  showPinyin,
}: {
  translation: ZhTranslationRow;
  view: ZhView;
  hide: boolean;
  showPinyin: boolean;
}) {
  if (view === "paragraph") {
    return (
      <SelfCover key={String(hide)} hide={hide}>
        <ZhSentence segments={translation.segments} showPinyin={showPinyin} context={translation.hanzi} />
      </SelfCover>
    );
  }
  // 가리기를 켜고 끌 때마다 확인한 문장을 처음부터
  return <SentenceList key={String(hide)} translation={translation} hide={hide} showPinyin={showPinyin} />;
}

function SentenceList({
  translation: t,
  hide,
  showPinyin,
}: {
  translation: ZhTranslationRow;
  hide: boolean;
  showPinyin: boolean;
}) {
  const pairs = useZhPairs(t, true);
  const [revealed, setRevealed] = React.useState<Set<number>>(() => new Set());
  const list = pairs.data;

  if (!list) {
    if (pairs.isError) {
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-caption text-muted">
            문장을 나누지 못했습니다.
            <button type="button" onClick={() => pairs.refetch()} className="font-medium text-accent hover:underline">
              다시 시도
            </button>
          </p>
          <ZhSentence segments={t.segments} showPinyin={showPinyin} context={t.hanzi} />
        </div>
      );
    }
    return (
      <div className="space-y-4" aria-busy>
        <p className="text-micro text-subtle">한 문장씩 나누는 중…</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const shown = hide ? revealed.size : list.length;
  const toggle = (i: number, on: boolean) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });

  return (
    <div>
      {hide && list.length > 1 && (
        <div className="mb-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(shown / list.length) * 100}%` }}
            />
          </div>
          <span className="text-micro tabular text-subtle">
            {shown}/{list.length}
          </span>
          {shown < list.length ? (
            <button
              type="button"
              onClick={() => setRevealed(new Set(list.map((_, i) => i)))}
              className="text-micro font-medium text-muted hover:text-foreground"
            >
              모두 보기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(new Set())}
              className="inline-flex items-center gap-1 text-micro font-medium text-muted hover:text-foreground"
            >
              <RotateCcw className="size-3" /> 처음부터
            </button>
          )}
        </div>
      )}

      <ol className="divide-y divide-border">
        {list.map((p, i) => {
          const covered = hide && !revealed.has(i);
          return (
            <li key={i} className="flex gap-3 py-3.5 first:pt-1 last:pb-0">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold tabular transition-colors",
                  hide && !covered ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p
                    className={cn(
                      "flex-1 leading-relaxed",
                      hide ? "text-[1.0625rem] font-medium text-foreground" : "text-caption text-muted",
                    )}
                  >
                    {p.ko}
                  </p>
                  {hide && !covered && (
                    <button
                      type="button"
                      onClick={() => toggle(i, false)}
                      aria-label="이 문장 다시 가리기"
                      title="다시 가리기"
                      className="-mr-1 rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <EyeOff className="size-3.5" />
                    </button>
                  )}
                </div>
                <Cover covered={covered} onReveal={() => toggle(i, true)} label="눌러서 확인" className="mt-2">
                  <ZhSentence
                    segments={t.segments.slice(p.from, p.to)}
                    showPinyin={showPinyin}
                    context={t.hanzi}
                    size="md"
                  />
                </Cover>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
