"use client";

import * as React from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { ZH_VOCAB_KIND_LABEL } from "@/lib/constants";
import type { ZhVocabRow } from "@/lib/types";
import { cn, relativeDayLabel, todayKey } from "@/lib/utils";
import { useDeleteZhVocab } from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ZhSentence } from "./zh-sentence";
import { SelfCover } from "./zh-study";

const KIND_TONE = { word: "accent", idiom: "warning", sentence: "neutral" } as const;

/** 단어장 카드: 앞면은 한자·병음·뜻, 펼치면 해석과 예문 */
export const VocabCard = React.forwardRef<
  HTMLElement,
  { item: ZhVocabRow; showPinyin: boolean; hide?: boolean; highlight?: boolean }
>(function VocabCard({ item, showPinyin, hide = false, highlight }, ref) {
  const toast = useToast();
  const del = useDeleteZhVocab();
  const [open, setOpen] = React.useState(!!highlight);
  const [confirm, setConfirm] = React.useState(false);

  // 새로 추가했거나 중복으로 찾아간 카드는 펼쳐서 보여 준다
  React.useEffect(() => {
    if (highlight) setOpen(true);
  }, [highlight]);

  const isSentence = item.kind === "sentence";
  const hasDetail = !!item.explanation || item.examples.length > 0;

  return (
    <article
      ref={ref}
      className={cn(
        "surface-card overflow-hidden transition-[border-color,box-shadow]",
        highlight && "border-accent/40 shadow-md",
      )}
    >
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <Badge tone={KIND_TONE[item.kind]}>{ZH_VOCAB_KIND_LABEL[item.kind]}</Badge>
          {item.part_of_speech && <span className="text-micro text-subtle">{item.part_of_speech}</span>}
          <span className="ml-auto text-micro text-subtle">
            {relativeDayLabel(todayKey(new Date(item.created_at)), todayKey())}
          </span>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label="삭제"
            className="-mr-1.5 rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* 앞면: 가리기 중엔 뜻을 먼저 크게, 중국어는 덮어 둔다 */}
        <div className={cn("mt-3 flex", hide ? "flex-col-reverse" : "flex-col")}>
          <SelfCover key={String(hide)} hide={hide} label="떠올려 본 뒤 눌러서 확인">
            {isSentence && item.segments.length > 0 ? (
              <ZhSentence segments={item.segments} showPinyin={showPinyin} context={item.hanzi} />
            ) : (
              <div lang="zh-CN">
                <p className={cn("font-medium tracking-wide", isSentence ? "text-[1.4rem]" : "text-[2rem] leading-tight")}>
                  {item.hanzi}
                </p>
                <p className={cn("mt-1 text-caption text-subtle", !showPinyin && "invisible")}>{item.pinyin}</p>
              </div>
            )}
          </SelfCover>
          <p
            className={cn(
              "whitespace-pre-line",
              hide ? "mb-3 text-[1.0625rem] font-medium leading-relaxed text-foreground" : "mt-3 text-body text-foreground/90",
            )}
          >
            {item.meaning}
          </p>
        </div>
      </div>

      {hasDetail && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-3 flex w-full items-center gap-1.5 border-t border-border px-5 py-2.5 text-caption font-medium text-muted transition-colors hover:bg-surface-2/60 hover:text-foreground"
          >
            {isSentence ? "표현 포인트 · 다르게 말하기" : "해석 · 예문"}
            <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="space-y-4 border-t border-border bg-surface-2/40 px-5 py-4 animate-fade-in">
              {item.explanation && (
                <SelfCover key={String(hide)} hide={hide} label="해석 보기">
                  <p className="border-l-2 border-accent/50 pl-3 text-caption leading-relaxed text-muted">
                    {item.explanation}
                  </p>
                </SelfCover>
              )}
              {item.examples.length > 0 && (
                <ol className="space-y-3">
                  {item.examples.map((ex, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-micro font-semibold text-subtle tabular">
                        {i + 1}
                      </span>
                      <div className={cn("flex min-w-0 flex-1", hide ? "flex-col-reverse" : "flex-col")}>
                        <SelfCover key={String(hide)} hide={hide} label="눌러서 확인">
                          <p lang="zh-CN" className="text-[1.0625rem] font-medium leading-snug">{ex.hanzi}</p>
                          <p className={cn("mt-0.5 text-micro text-subtle", !showPinyin && "hidden")}>{ex.pinyin}</p>
                        </SelfCover>
                        <p className={cn("text-caption", hide ? "mb-1.5 text-foreground/90" : "mt-0.5 text-muted")}>
                          {ex.ko}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}
      {!hasDetail && <div className="h-4" />}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="단어장에서 삭제할까요?"
        description={`"${item.hanzi}" 카드와 예문이 삭제됩니다.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>취소</Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() =>
                del.mutate(item.id, {
                  onSuccess: () => setConfirm(false),
                  onError: (e) => toast.push({ tone: "error", title: "삭제 실패", description: e.message }),
                })
              }
            >
              삭제
            </Button>
          </>
        }
      />
    </article>
  );
});
