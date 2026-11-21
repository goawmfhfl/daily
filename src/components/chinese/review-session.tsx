"use client";

import * as React from "react";
import { Check, PartyPopper, RotateCcw, X } from "lucide-react";
import type { ZhVocabRow } from "@/lib/types";
import { ZH_VOCAB_KIND_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useReviewZhVocab } from "@/lib/query/hooks";
import { nextKnowLabel, STATUS_META, vocabStatus, type ReviewAction } from "@/lib/zh-review";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { StageDots } from "./stage-dots";

type Direction = "zh" | "ko";
const DIR_KEY = "daily:zh-review-dir";

interface Result {
  id: string;
  action: ReviewAction;
}

/**
 * 오늘 외우기: 한 장씩 보고 스스로 "외웠어요 / 아직"을 체크한다. 시험이 아니므로
 * 답을 펼치지 않고도 바로 넘길 수 있다. "아직"인 단어는 세션 끝에 한 번 더 나온다.
 */
export function ReviewSession({
  open,
  onClose,
  queue: initialQueue,
  items,
  today,
  showPinyin,
}: {
  open: boolean;
  onClose: () => void;
  /** 세션을 시작할 때 고정한 순서 (단어 id) */
  queue: string[];
  /** 최신 단어 데이터 (단계·뜻 표시용) */
  items: ZhVocabRow[];
  today: string;
  showPinyin: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const review = useReviewZhVocab();
  const [queue, setQueue] = React.useState(initialQueue);
  const [pos, setPos] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [results, setResults] = React.useState<Result[]>([]);
  const [requeued, setRequeued] = React.useState<Set<string>>(() => new Set());
  const [dir, setDir] = React.useState<Direction>(() => {
    try {
      return localStorage.getItem(DIR_KEY) === "ko" ? "ko" : "zh";
    } catch {
      return "zh";
    }
  });

  const byId = React.useMemo(() => new Map(items.map((v) => [v.id, v])), [items]);
  const currentId = queue[pos];
  const item = currentId ? byId.get(currentId) : undefined;
  const done = pos >= queue.length;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function changeDir(d: Direction) {
    setDir(d);
    try {
      localStorage.setItem(DIR_KEY, d);
    } catch {}
  }

  const mark = React.useCallback(
    (action: "know" | "again") => {
      if (!item) return;
      review.mutate(
        { id: item.id, action },
        { onError: (e) => toast.push({ tone: "error", title: "저장하지 못했습니다", description: e.message }) },
      );
      setResults((r) => [...r.filter((x) => x.id !== item.id), { id: item.id, action }]);
      // 아직이면 끝에 한 번 더 (같은 세션에서 두 번까지만)
      if (action === "again" && !requeued.has(item.id)) {
        setQueue((q) => [...q, item.id]);
        setRequeued((s) => new Set(s).add(item.id));
      }
      setPos((p) => p + 1);
      setRevealed(false);
    },
    [item, review, requeued, toast],
  );

  React.useEffect(() => {
    if (!open || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setRevealed((v) => !v);
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        mark("again");
      } else if (e.key === "ArrowRight" || e.key === "2") {
        e.preventDefault();
        mark("know");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, done, mark]);

  const known = results.filter((r) => r.action === "know").length;
  const again = results.length - known;
  const total = queue.length;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-background p-0 text-foreground backdrop:bg-black/50 open:animate-fade-in sm:m-auto sm:h-[min(44rem,92dvh)] sm:w-[min(40rem,94vw)] sm:rounded-2xl sm:border sm:border-border sm:shadow-lg"
    >
      <div className="flex h-full flex-col">
        {/* 머리: 진행, 방향, 닫기 */}
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold">오늘 외우기</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${total ? (Math.min(pos, total) / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-micro tabular text-subtle">
                {Math.min(pos + (done ? 0 : 1), total)}/{total}
              </span>
            </div>
          </div>
          <Segmented<Direction>
            size="sm"
            value={dir}
            onChange={changeDir}
            options={[
              { value: "zh", label: "중→한" },
              { value: "ko", label: "한→중" },
            ]}
          />
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        {done || !item ? (
          <Finished known={known} again={again} onClose={onClose} />
        ) : (
          <>
            {/* 카드: 누르면 답 펼치기 */}
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="group flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-micro font-medium text-subtle">{ZH_VOCAB_KIND_LABEL[item.kind]}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-micro font-semibold",
                    STATUS_META[vocabStatus(item, today)].tone,
                  )}
                >
                  {STATUS_META[vocabStatus(item, today)].short}
                </span>
              </div>

              <div className="mt-6 w-full" key={`${item.id}:${pos}`}>
                {dir === "zh" ? (
                  <Hanzi item={item} showPinyin={showPinyin} />
                ) : (
                  <p className="whitespace-pre-line text-[1.5rem] font-semibold leading-snug">{item.meaning}</p>
                )}

                <div
                  className={cn(
                    "mx-auto mt-6 max-w-md transition-opacity duration-200",
                    revealed ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                  aria-hidden={!revealed}
                >
                  <div className="mx-auto mb-5 h-px w-16 bg-border" />
                  {dir === "zh" ? (
                    <p className="whitespace-pre-line text-[1.125rem] font-medium leading-relaxed">{item.meaning}</p>
                  ) : (
                    <Hanzi item={item} showPinyin />
                  )}
                  {dir === "zh" && !showPinyin && (
                    <p className="mt-1 text-caption text-subtle" lang="zh-CN">{item.pinyin}</p>
                  )}
                  {item.examples[0] && (
                    <div className="mt-5 rounded-lg bg-surface-2 px-4 py-3 text-left">
                      <p lang="zh-CN" className="text-body font-medium">{item.examples[0].hanzi}</p>
                      <p className="mt-0.5 text-micro text-subtle">{item.examples[0].pinyin}</p>
                      <p className="mt-1 text-caption text-muted">{item.examples[0].ko}</p>
                    </div>
                  )}
                </div>
              </div>

              {!revealed && (
                <span className="mt-8 rounded-full border border-border px-3 py-1 text-caption text-muted transition-colors group-hover:text-foreground">
                  눌러서 {dir === "zh" ? "뜻" : "중국어"} 보기 <kbd className="ml-1 text-micro text-subtle">Space</kbd>
                </span>
              )}
            </button>

            {/* 체크 */}
            <footer className="border-t border-border px-4 py-4 safe-bottom sm:px-5">
              <div className="mb-3 flex items-center justify-center gap-2 text-micro text-subtle">
                <StageDots stage={item.stage} />
                <span>외웠어요 → {nextKnowLabel(item.stage)} 다시</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="lg" onClick={() => mark("again")} className="h-12">
                  <RotateCcw className="size-4" /> 아직이에요
                  <kbd className="ml-1 hidden text-micro text-subtle sm:inline">←</kbd>
                </Button>
                <Button variant="accent" size="lg" onClick={() => mark("know")} className="h-12">
                  <Check className="size-4" /> 외웠어요
                  <kbd className="ml-1 hidden text-micro opacity-70 sm:inline">→</kbd>
                </Button>
              </div>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

function Hanzi({ item, showPinyin }: { item: ZhVocabRow; showPinyin: boolean }) {
  const long = item.hanzi.length > 8;
  return (
    <div lang="zh-CN">
      <p className={cn("font-medium tracking-wide", long ? "text-[1.6rem] leading-snug" : "text-[2.75rem] leading-tight")}>
        {item.hanzi}
      </p>
      {showPinyin && <p className="mt-2 text-body text-subtle">{item.pinyin}</p>}
    </div>
  );
}

function Finished({ known, again, onClose }: { known: number; again: number; onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center animate-fade-up">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <PartyPopper className="size-6" />
      </span>
      <p className="mt-4 text-title font-semibold tracking-tight">오늘 외우기 끝</p>
      <p className="mt-2 text-body text-muted">
        외움 <b className="text-success">{known}</b> · 아직 <b className="text-warning">{again}</b>
      </p>
      <p className="mt-3 max-w-xs text-caption text-subtle">
        외운 단어는 내일, 3일, 1주, 2주, 1달, 3달 간격으로 다시 나옵니다. 아직인 단어는 오늘 목록에 남아 있어요.
      </p>
      <Button className="mt-6" onClick={onClose}>
        단어장으로
      </Button>
    </div>
  );
}
