"use client";

import * as React from "react";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import type { ZhSegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAddZhVocab, useZhVocab, useZhVocabJobs } from "@/lib/query/hooks";
import { Spinner } from "@/components/ui/spinner";

const isPunct = (s: string) => !/\p{Script=Han}/u.test(s) && !/[A-Za-z0-9]/.test(s);

/**
 * 한자를 크게, 단어마다 바로 아래에 병음을 작게 붙인다 (ruby, 아래쪽 정렬).
 * 단어를 누르면 그 단어의 뜻이 아래에 보이고, 단어장에 바로 넣을 수 있다.
 */
export function ZhSentence({
  segments,
  showPinyin,
  context,
  size = "lg",
  className,
}: {
  segments: ZhSegment[];
  showPinyin: boolean;
  /** lg: 카드 본문, md: 문장별 목록 */
  size?: "lg" | "md";
  /** 단어장에 넣을 때 뜻을 문맥에 맞추기 위한 문장 전체 */
  context?: string;
  className?: string;
}) {
  const [picked, setPicked] = React.useState<number | null>(null);
  const word = picked !== null ? segments[picked] : null;
  const glyph = size === "lg" ? "text-[1.6rem]" : "text-[1.3rem]";

  return (
    <div className={className}>
      <p lang="zh-CN" className="flex flex-wrap items-end gap-x-1.5 gap-y-2 leading-none">
        {segments.map((s, i) => {
          if (isPunct(s.hanzi)) {
            // 빈 병음 줄을 같은 높이로 두어 한자와 같은 기준선에 앉힌다
            return (
              <ruby key={i} className="-ml-1.5 py-0.5 [ruby-position:under]" aria-hidden>
                <span className={cn(glyph, "text-foreground/70")}>{s.hanzi}</span>
                <rt className="invisible pt-1 text-[0.7rem]">&nbsp;</rt>
              </ruby>
            );
          }
          const active = picked === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPicked(active ? null : i)}
              aria-pressed={active}
              title={s.ko || undefined}
              className={cn(
                "rounded-md px-0.5 py-0.5 transition-colors",
                active ? "bg-accent-soft" : "hover:bg-surface-2",
              )}
            >
              <ruby className="[ruby-position:under]">
                <span className={cn(glyph, "font-medium tracking-wide text-foreground")}>{s.hanzi}</span>
                <rt
                  className={cn(
                    "pt-1 text-[0.7rem] font-normal tracking-normal text-subtle",
                    !showPinyin && "invisible",
                  )}
                >
                  {s.pinyin}
                </rt>
              </ruby>
            </button>
          );
        })}
      </p>
      {word && <WordDetail key={word.hanzi} word={word} context={context} />}
    </div>
  );
}

function WordDetail({ word, context }: { word: ZhSegment; context?: string }) {
  const vocab = useZhVocab();
  const add = useAddZhVocab();
  const jobs = useZhVocabJobs();
  const saved = vocab.data?.some((v) => v.kind !== "sentence" && v.hanzi === word.hanzi);
  // 다른 화면에서 보낸 요청이어도 진행 중이면 표시
  const pending = jobs.some((j) => j.status === "pending" && j.text === word.hanzi);

  function save() {
    // 결과 알림과 단어장 반영은 훅이 처리한다 (이 화면을 떠나도 끝까지)
    add.mutate({ text: word.hanzi, context: context ?? null });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-surface-2 px-3 py-2 text-caption animate-fade-in">
      <span lang="zh-CN" className="text-body font-semibold">{word.hanzi}</span>
      <span className="text-muted">{word.pinyin}</span>
      {word.ko && <span className="text-foreground/85">· {word.ko}</span>}
      <button
        type="button"
        onClick={save}
        disabled={saved || pending}
        className={cn(
          "ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-medium transition-colors",
          saved
            ? "text-accent"
            : "bg-surface text-foreground shadow-sm hover:bg-surface-3 disabled:opacity-70",
        )}
      >
        {pending ? (
          <Spinner className="size-3.5" />
        ) : saved ? (
          <BookmarkCheck className="size-3.5" />
        ) : (
          <BookmarkPlus className="size-3.5" />
        )}
        {saved ? "단어장에 있음" : pending ? "예문 만드는 중…" : "단어장에 추가"}
      </button>
    </div>
  );
}
