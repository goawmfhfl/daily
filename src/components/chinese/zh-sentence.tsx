"use client";

import * as React from "react";
import type { ZhSegment } from "@/lib/types";
import { cn } from "@/lib/utils";

const isPunct = (s: string) => !/\p{Script=Han}/u.test(s) && !/[A-Za-z0-9]/.test(s);

/**
 * 한자를 크게, 단어마다 바로 아래에 병음을 작게 붙인다 (ruby, 아래쪽 정렬).
 * 단어를 누르면 그 단어의 뜻이 아래에 보인다.
 */
export function ZhSentence({
  segments,
  showPinyin,
  className,
}: {
  segments: ZhSegment[];
  showPinyin: boolean;
  className?: string;
}) {
  const [picked, setPicked] = React.useState<number | null>(null);
  const word = picked !== null ? segments[picked] : null;

  return (
    <div className={className}>
      <p lang="zh-CN" className="flex flex-wrap items-end gap-x-1.5 gap-y-2 leading-none">
        {segments.map((s, i) => {
          if (isPunct(s.hanzi)) {
            // 빈 병음 줄을 같은 높이로 두어 한자와 같은 기준선에 앉힌다
            return (
              <ruby key={i} className="-ml-1.5 py-0.5 [ruby-position:under]" aria-hidden>
                <span className="text-[1.6rem] text-foreground/70">{s.hanzi}</span>
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
                <span className="text-[1.6rem] font-medium tracking-wide text-foreground">{s.hanzi}</span>
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
      {word && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 rounded-md bg-surface-2 px-3 py-2 text-caption animate-fade-in">
          <span lang="zh-CN" className="text-body font-semibold">{word.hanzi}</span>
          <span className="text-muted">{word.pinyin}</span>
          {word.ko && <span className="text-foreground/85">· {word.ko}</span>}
        </p>
      )}
    </div>
  );
}
