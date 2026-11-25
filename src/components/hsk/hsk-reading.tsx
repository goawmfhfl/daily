"use client";

import * as React from "react";
import { ArrowRight, Check, Clock, Flag, Languages, LocateFixed, NotebookPen, Quote, X } from "lucide-react";
import type { HskBlank, HskGraded, HskSetRow } from "@/lib/types";
import { HSK_KIND_LABEL, OPTION_LETTERS, UNDERLINE } from "@/lib/hsk";
import { cn } from "@/lib/utils";
import { useSubmitHsk } from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { SelectToVocab } from "@/components/chinese/select-to-vocab";
import { ReportDialog, ScoreCard, SelectHint, SetHeader, mmss } from "./hsk-solve";

/*
 * HSK 독해 3부분 · 독해 이해
 * 넓은 화면에서는 지문을 왼쪽에 붙여 두고 오른쪽에서 문항을 푼다.
 * 채점 뒤에는 문항마다 근거 문장을 지문에 표시해 준다.
 */

/* ───────── 지문 ───────── */

/** 지문을 그린다: [[표현]] 은 밑줄, highlight 와 같은 부분은 형광펜 */
function ReadingText({ passage, highlight }: { passage: string; highlight?: string }) {
  const segs: Array<{ text: string; u: boolean }> = [];
  let last = 0;
  for (const m of passage.matchAll(new RegExp(UNDERLINE.source, "g"))) {
    if (m.index! > last) segs.push({ text: passage.slice(last, m.index), u: false });
    segs.push({ text: m[1], u: true });
    last = m.index! + m[0].length;
  }
  if (last < passage.length) segs.push({ text: passage.slice(last), u: false });

  const plain = segs.map((s) => s.text).join("");
  const from = highlight ? plain.indexOf(highlight) : -1;
  const to = from >= 0 ? from + highlight!.length : -1;

  const nodes: React.ReactNode[] = [];
  let offset = 0;
  segs.forEach((s, si) => {
    const start = offset;
    const end = offset + s.text.length;
    offset = end;
    // 형광펜 범위로 이 조각을 최대 세 부분으로 나눈다
    const cuts = [start, ...(from >= 0 ? [from, to] : []), end]
      .filter((c) => c >= start && c <= end)
      .sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      if (a === b) continue;
      const piece = plain.slice(a, b);
      const marked = from >= 0 && a >= from && b <= to;
      let node: React.ReactNode = piece;
      if (s.u) node = <u className="decoration-accent decoration-2 underline-offset-4">{node}</u>;
      if (marked)
        node = (
          <mark data-evidence className="rounded-sm bg-warning-soft px-0.5 text-foreground ring-1 ring-warning/30">
            {node}
          </mark>
        );
      nodes.push(<React.Fragment key={`${si}-${a}`}>{node}</React.Fragment>);
    }
  });

  return (
    <p data-zh-context lang="zh-CN" className="whitespace-pre-line text-[1.0625rem] leading-[2] tracking-wide text-foreground/95">
      {nodes}
    </p>
  );
}

/** 넓은 화면에서 왼쪽에 붙어 있는 지문 카드 */
function PassageCard({ children, scrollRef }: { children: React.ReactNode; scrollRef?: React.Ref<HTMLDivElement> }) {
  return (
    <Card className="lg:sticky lg:top-6">
      <div ref={scrollRef} className="lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
        <CardBody className="space-y-4">{children}</CardBody>
      </div>
    </Card>
  );
}

/* ───────── 풀이 ───────── */

export function ReadingSolve({
  set,
  mode,
  retryNos,
  onDone,
  onQuit,
}: {
  set: HskSetRow;
  mode: "first" | "retry";
  retryNos?: number[];
  onDone: (r: { selected: Record<string, number>; graded: HskGraded[]; duration: number }) => void;
  onQuit: () => void;
}) {
  const toast = useToast();
  const submit = useSubmitHsk();
  // 다시 풀기는 틀렸던 문항만 보여 준다
  const targets = React.useMemo(
    () => set.blanks.filter((b) => mode === "first" || retryNos?.includes(b.no)),
    [set.blanks, mode, retryNos],
  );
  const [picked, setPicked] = React.useState<Record<number, number>>({});
  const [active, setActive] = React.useState(targets[0]?.no ?? 1);
  const [startedAt] = React.useState(() => Date.now());
  const [elapsed, setElapsed] = React.useState(0);
  const refs = React.useRef(new Map<number, HTMLElement>());

  React.useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const answered = targets.filter((b) => picked[b.no] !== undefined).length;
  const ready = answered === targets.length;

  const choose = React.useCallback(
    (no: number, opt: number) => {
      const next = { ...picked, [no]: opt };
      setPicked(next);
      const after =
        targets.find((b) => b.no > no && next[b.no] === undefined) ?? targets.find((b) => next[b.no] === undefined);
      if (after) {
        setActive(after.no);
        refs.current.get(after.no)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [picked, targets],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const idx = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
      if (idx >= 0 && targets.some((b) => b.no === active)) {
        e.preventDefault();
        choose(active, idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, choose, targets]);

  function send() {
    const selected = Object.fromEntries(targets.map((b) => [String(b.no), picked[b.no]]));
    submit.mutate(
      { set_id: set.id, mode, selected, duration_sec: elapsed, level: set.level },
      {
        onSuccess: ({ graded }) => onDone({ selected, graded, duration: elapsed }),
        onError: (e) => toast.push({ tone: "error", title: "채점하지 못했습니다", description: e.message }),
      },
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <SetHeader
        set={set}
        right={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-caption tabular text-subtle" title="걸린 시간">
              <Clock className="size-3.5" /> {mmss(elapsed)}
            </span>
            <Button variant="ghost" size="sm" onClick={onQuit}>그만두기</Button>
          </div>
        }
        badge={mode === "retry" ? <Badge tone="warning">다시 풀기 · {targets.length}문항</Badge> : null}
      />

      <SelectToVocab className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <PassageCard>
          <ReadingText passage={set.passage} />
          <SelectHint />
        </PassageCard>

        <ol className="space-y-3">
          {targets.map((b) => (
            <li
              key={b.no}
              ref={(el) => {
                if (el) refs.current.set(b.no, el);
                else refs.current.delete(b.no);
              }}
              onClick={() => setActive(b.no)}
              className={cn(
                "surface-card scroll-mt-24 px-4 py-3.5 transition-[border-color,box-shadow]",
                active === b.no && "border-accent/50 shadow-md",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-bold tabular",
                    active === b.no ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted",
                  )}
                >
                  {b.no}
                </span>
                <p lang="zh-CN" data-zh-context className="flex-1 text-[1.0625rem] font-medium leading-relaxed">
                  {b.stem}
                </p>
                {picked[b.no] !== undefined && <Check className="mt-1 size-4 shrink-0 text-accent" />}
              </div>
              <div className="mt-3 space-y-1.5">
                {b.options.map((o, i) => {
                  const on = picked[b.no] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActive(b.no);
                        choose(b.no, i);
                      }}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
                      )}
                    >
                      <span className={cn("mt-0.5 w-4 shrink-0 text-caption font-bold", on ? "opacity-80" : "text-subtle")}>
                        {OPTION_LETTERS[i]}
                      </span>
                      <span lang="zh-CN" className="text-body leading-relaxed">{o}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </SelectToVocab>

      <div className="sticky bottom-20 z-20 md:bottom-6">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface/95 p-2 pl-4 shadow-lg backdrop-blur">
          <span className="flex-1 text-caption text-muted">
            {ready ? "다 골랐어요" : `${answered}/${targets.length} 골랐어요`}
            <span className="ml-2 hidden text-micro text-subtle sm:inline">A~D 키로도 고를 수 있어요</span>
          </span>
          <Button onClick={send} disabled={!ready} loading={submit.isPending}>
            제출 <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────── 채점 결과 ───────── */

export function ReadingResult({
  set,
  selected,
  graded,
  duration,
  mode,
  onNext,
  onHome,
}: {
  set: HskSetRow;
  selected: Record<string, number>;
  graded: HskGraded[];
  duration: number | null;
  mode: "first" | "retry";
  onNext?: () => void;
  onHome: () => void;
}) {
  const correct = graded.filter((g) => g.correct).length;
  const gradedNos = new Set(graded.map((g) => g.no));
  const questions = set.blanks.filter((b) => gradedNos.has(b.no));
  // 처음엔 첫 번째로 틀린 문항의 근거를 보여 준다
  const [active, setActive] = React.useState(() => graded.find((g) => !g.correct)?.no ?? questions[0]?.no ?? 1);
  const [showKo, setShowKo] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const highlight = set.blanks.find((b) => b.no === active)?.evidence || undefined;

  const [jump, setJump] = React.useState(0);
  function locate(no: number) {
    setActive(no);
    setJump((j) => j + 1);
  }
  // 형광펜이 그려진 뒤 그 위치로 (넓은 화면은 지문 카드 안에서, 좁은 화면은 페이지에서)
  React.useEffect(() => {
    if (!jump) return;
    scrollRef.current?.querySelector("mark[data-evidence]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [jump]);

  return (
    <div className="space-y-5">
      <SetHeader set={set} right={<Button variant="ghost" size="sm" onClick={onHome}>독해 홈</Button>} />
      <ScoreCard correct={correct} total={graded.length} duration={duration} mode={mode} onNext={onNext} unit="문항" />

      <SelectToVocab className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <PassageCard scrollRef={scrollRef}>
          {highlight && (
            <p className="flex items-center gap-1.5 text-micro font-medium text-warning">
              <LocateFixed className="size-3.5" /> {active}번 근거를 표시했어요
            </p>
          )}
          <ReadingText passage={set.passage} highlight={highlight} />
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowKo((v) => !v)} aria-expanded={showKo}>
              <Languages className="size-3.5" /> {showKo ? "해석 접기" : "지문 해석 보기"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} className="ml-auto text-subtle">
              <Flag className="size-3.5" /> 정답이 이상해요
            </Button>
          </div>
          {showKo && (
            <p className="whitespace-pre-line rounded-lg bg-surface-2 px-4 py-3 text-body leading-relaxed text-foreground/90 animate-fade-in">
              {set.translation_ko}
            </p>
          )}
          <SelectHint />
        </PassageCard>

        <ol className="space-y-3">
          {questions.map((b) => (
            <QuestionReview
              key={b.no}
              blank={b}
              graded={graded.find((g) => g.no === b.no)!}
              selected={selected[String(b.no)]}
              active={active === b.no}
              onLocate={() => locate(b.no)}
            />
          ))}
          <li className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" onClick={onHome}>
              <NotebookPen className="size-4" /> 오답노트 보기
            </Button>
            {onNext && (
              <Button onClick={onNext}>
                다음 세트 <ArrowRight className="size-4" />
              </Button>
            )}
          </li>
        </ol>
      </SelectToVocab>

      <ReportDialog open={confirm} onClose={() => setConfirm(false)} set={set} onDone={onHome} />
    </div>
  );
}

function QuestionReview({
  blank: b,
  graded: g,
  selected,
  active,
  onLocate,
}: {
  blank: HskBlank;
  graded: HskGraded;
  selected: number;
  active: boolean;
  onLocate: () => void;
}) {
  return (
    <li
      className={cn(
        "surface-card overflow-hidden transition-[border-color,box-shadow]",
        !g.correct && "border-danger/30",
        active && "shadow-md ring-1 ring-warning/40",
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-micro font-bold tabular",
            g.correct ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
          )}
        >
          {b.no}
        </span>
        <Badge>{HSK_KIND_LABEL[b.kind]}</Badge>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-caption font-semibold", g.correct ? "text-success" : "text-danger")}>
          {g.correct ? <Check className="size-4" /> : <X className="size-4" />}
          {g.correct ? "정답" : "오답"}
        </span>
      </div>
      <p lang="zh-CN" data-zh-context className="mx-4 mt-2.5 text-[1.0625rem] font-medium leading-relaxed">{b.stem}</p>

      {b.evidence && (
        <div className="mx-4 mt-3 rounded-lg bg-warning-soft/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-micro font-semibold text-warning">
            <Quote className="size-3.5" /> 근거
            <button
              type="button"
              onClick={onLocate}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <LocateFixed className="size-3" /> 본문에서 보기
            </button>
          </div>
          <p lang="zh-CN" data-zh-context className="mt-1 text-body leading-relaxed text-foreground/90">{b.evidence}</p>
        </div>
      )}
      <p className="mx-4 mt-3 border-l-2 border-accent/50 pl-3 text-body leading-relaxed text-foreground/90">{b.explanation}</p>

      <ul className="mt-3 divide-y divide-border border-t border-border">
        {b.options.map((o, i) => {
          const isAnswer = i === b.answer;
          const isMine = i === selected;
          return (
            <li
              key={i}
              className={cn("flex items-start gap-3 px-4 py-2.5", isAnswer && "bg-success-soft/40", isMine && !isAnswer && "bg-danger-soft/40")}
            >
              <span className="mt-0.5 w-4 text-micro font-bold text-subtle">{OPTION_LETTERS[i]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span lang="zh-CN" data-zh-context className="text-body font-medium">{o}</span>
                  {isAnswer && <Badge tone="success">정답</Badge>}
                  {isMine && !isAnswer && <Badge tone="danger">내 선택</Badge>}
                </div>
                <p className="mt-0.5 text-caption leading-relaxed text-muted">{b.option_notes[i]}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
