"use client";

import * as React from "react";
import { Check, ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { ZH_VOCAB_KIND_LABEL } from "@/lib/constants";
import type { ZhVocabRow } from "@/lib/types";
import { cn, relativeDayLabel, todayKey } from "@/lib/utils";
import { useDeleteZhVocab, useReviewZhVocab } from "@/lib/query/hooks";
import { dueLabel, isStudyToday, nextKnowLabel, STATUS_META, vocabStatus, type ReviewAction } from "@/lib/zh-review";
import { StageDots } from "./stage-dots";
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
  { item: ZhVocabRow; showPinyin: boolean; hide?: boolean; today: string; highlight?: boolean }
>(function VocabCard({ item, showPinyin, hide = false, today, highlight }, ref) {
  const toast = useToast();
  const del = useDeleteZhVocab();
  const review = useReviewZhVocab();
  const status = vocabStatus(item, today);
  const meta = STATUS_META[status];

  function mark(action: ReviewAction, done?: string) {
    review.mutate(
      { id: item.id, action },
      {
        onSuccess: () => done && toast.push({ tone: "success", title: done }),
        onError: (e) => toast.push({ tone: "error", title: "저장하지 못했습니다", description: e.message }),
      },
    );
  }
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
          <span className={cn("rounded-full px-2 py-0.5 text-micro font-semibold", meta.tone)}>{meta.short}</span>
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

      {/* 암기 체크: 시험 없이 스스로. 외우면 내일 → 3일 → 1주 → 2주 → 1달 → 3달 뒤 다시 나온다 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-5 py-2.5">
        <StageDots stage={item.stage} />
        <span className="text-micro text-subtle">
          {status === "scheduled"
            ? dueLabel(item.due_on, today)
            : status === "mastered"
              ? "더 이상 복습하지 않아요"
              : status === "learning"
                ? "오늘 다시 외워 보세요"
                : status === "due"
                  ? "복습할 때가 됐어요"
                  : "아직 외우지 않음"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {isStudyToday(status) ? (
            <>
              {status === "new" && (
                <Button variant="ghost" size="sm" onClick={() => mark("master", "완전히 외운 단어로 옮겼어요")}>
                  이미 알아요
                </Button>
              )}
              {status !== "new" && (
                <Button variant="ghost" size="sm" onClick={() => mark("again")} title="외우는 중으로">
                  <RotateCcw className="size-3.5" /> 아직
                </Button>
              )}
              <Button
                variant="soft"
                size="sm"
                onClick={() => mark("know", `외웠어요 · ${nextKnowLabel(item.stage)} 다시 나와요`)}
                title={`${nextKnowLabel(item.stage)} 다시 복습`}
              >
                <Check className="size-3.5" /> 외웠어요
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => mark("again", "외우는 중으로 옮겼어요")}>
              <RotateCcw className="size-3.5" /> 다시 외우기
            </Button>
          )}
        </div>
      </div>

      {hasDetail && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 border-t border-border px-5 py-2.5 text-caption font-medium text-muted transition-colors hover:bg-surface-2/60 hover:text-foreground"
          >
            {isSentence ? "표현 포인트 · 다르게 말하기" : "해석 · 예문"}
            <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="space-y-4 border-t border-border bg-surface-2/40 px-5 py-4 animate-fade-in">
              {item.explanation && (
                <SelfCover key={String(hide)} hide={hide} label="해석 보기">
                  <p data-zh-context className="border-l-2 border-accent/50 pl-3 text-caption leading-relaxed text-muted">
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
                          <p data-zh-context lang="zh-CN" className="text-[1.0625rem] font-medium leading-snug">{ex.hanzi}</p>
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
