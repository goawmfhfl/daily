"use client";

import * as React from "react";
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Clock,
  Flag,
  Languages,
  NotebookPen,
  X,
} from "lucide-react";
import type { HskBlank, HskChoice, HskGraded, HskSetRow } from "@/lib/types";
import { HSK_KIND_LABEL, OPTION_LETTERS, sentenceWithBlank, splitPassage } from "@/lib/hsk";
import { cn } from "@/lib/utils";
import { useAddZhVocab, useReportHsk, useSubmitHsk, useZhVocab, useZhVocabJobs } from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { SelectToVocab } from "@/components/chinese/select-to-vocab";
import { useToast } from "@/components/ui/toast";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/* ───────── 풀이 ───────── */

/**
 * 지문 + 빈칸별 보기. 다시 풀기면 틀렸던 빈칸만 풀고 나머지는 정답으로 채워 둔다.
 * 보기를 고르면 다음 안 푼 빈칸으로 넘어가고, A~D·1~4 키로도 고를 수 있다.
 */
export function HskSolve({
  set,
  mode,
  retryNos,
  onDone,
  onQuit,
}: {
  set: HskSetRow;
  mode: "first" | "retry";
  /** 다시 풀기에서 풀 빈칸 번호 */
  retryNos?: number[];
  onDone: (r: { selected: Record<string, number>; graded: HskGraded[]; duration: number }) => void;
  onQuit: () => void;
}) {
  const toast = useToast();
  const submit = useSubmitHsk();
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

  const isTarget = (no: number) => targets.some((b) => b.no === no);
  /** 2부분: 빈칸들이 보기 6개(A~F)를 함께 쓴다 */
  const isSentence = set.part === 2;
  const choices = set.choices ?? [];
  const optionText = (b: HskBlank, i: number) => (isSentence ? (choices[i]?.text ?? "") : b.options[i]);
  const keys = isSentence ? "abcdef" : "abcd";
  const answered = targets.filter((b) => picked[b.no] !== undefined).length;
  const ready = answered === targets.length;

  const choose = React.useCallback(
    (no: number, opt: number) => {
      const next = { ...picked, [no]: opt };
      // 2부분은 한 보기를 한 번만: 다른 빈칸에 쓰였으면 거기서 뺀다
      if (isSentence) for (const k of Object.keys(next)) if (Number(k) !== no && next[Number(k)] === opt) delete next[Number(k)];
      setPicked(next);
      // 다음 안 푼 빈칸으로
      const after =
        targets.find((b) => b.no > no && next[b.no] === undefined) ?? targets.find((b) => next[b.no] === undefined);
      if (after) setActive(after.no);
    },
    [picked, targets, isSentence],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const idx = keys.indexOf(k) >= 0 ? keys.indexOf(k) : "123456".slice(0, keys.length).indexOf(k);
      if (idx >= 0 && isTarget(active)) {
        e.preventDefault();
        choose(active, idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, choose, targets, keys]);

  function focusBlank(no: number) {
    if (!isTarget(no)) return;
    setActive(no);
    refs.current.get(no)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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

  const fill = (b: HskBlank) =>
    !isTarget(b.no)
      ? { idx: b.answer, tone: "given" as const }
      : picked[b.no] !== undefined
        ? { idx: picked[b.no], tone: "picked" as const }
        : null;

  return (
    <div className="space-y-5 pb-24">
      <SetHeader set={set} right={
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-caption tabular text-subtle" title="걸린 시간">
            <Clock className="size-3.5" /> {mmss(elapsed)}
          </span>
          <Button variant="ghost" size="sm" onClick={onQuit}>그만두기</Button>
        </div>
      } badge={mode === "retry" ? <Badge tone="warning">다시 풀기 · {targets.length}문항</Badge> : null} />

      <SelectToVocab>
      <Card>
        <CardBody>
          <Passage
            set={set}
            render={(no) => {
              const b = set.blanks.find((x) => x.no === no)!;
              const f = fill(b);
              return (
                <BlankChip
                  no={no}
                  word={f ? optionText(b, f.idx) : undefined}
                  letter={isSentence && f ? OPTION_LETTERS[f.idx] : undefined}
                  wide={isSentence}
                  tone={f?.tone === "given" ? "given" : active === no ? "active" : f ? "picked" : "empty"}
                  onClick={() => focusBlank(no)}
                />
              );
            }}
          />
          <SelectHint />
        </CardBody>
      </Card>
      </SelectToVocab>

      {isSentence ? (
        <SentenceBoard
          choices={choices}
          active={active}
          picked={picked}
          targets={targets.map((b) => b.no)}
          given={set.blanks.filter((b) => !isTarget(b.no)).map((b) => ({ no: b.no, idx: b.answer }))}
          onChoose={(i) => isTarget(active) && choose(active, i)}
        />
      ) : (
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
            <div className="mb-2.5 flex items-center gap-2">
              <span className={cn(
                "flex size-6 items-center justify-center rounded-full text-micro font-bold tabular",
                active === b.no ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted",
              )}>
                {b.no}
              </span>
              {picked[b.no] !== undefined && <Check className="size-3.5 text-accent" />}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {b.options.map((o, i) => {
                const on = picked[b.no] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      choose(b.no, i);
                    }}
                    aria-pressed={on}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-lg border px-3 text-left transition-colors",
                      on
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
                    )}
                  >
                    <span className={cn("text-micro font-bold", on ? "opacity-80" : "text-subtle")}>{OPTION_LETTERS[i]}</span>
                    <span lang="zh-CN" className="text-[1.0625rem] font-medium">{o}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      )}

      {/* 제출: 화면 아래에 붙어 있다 */}
      <div className="sticky bottom-20 z-20 md:bottom-6">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface/95 p-2 pl-4 shadow-lg backdrop-blur">
          <span className="flex-1 text-caption text-muted">
            {ready ? "다 골랐어요" : `${answered}/${targets.length} 골랐어요`}
            <span className="ml-2 hidden text-micro text-subtle sm:inline">
              {isSentence ? "A~F" : "A~D"} 키로도 고를 수 있어요
            </span>
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

export function HskResult({
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
  const toast = useToast();
  const report = useReportHsk();
  const [showKo, setShowKo] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const correct = graded.filter((g) => g.correct).length;
  const gradedNos = new Set(graded.map((g) => g.no));
  const perfect = correct === graded.length;
  const isSentence = set.part === 2;
  const choices = set.choices ?? [];
  const text = (b: HskBlank, i: number) => (isSentence ? (choices[i]?.text ?? "") : b.options[i]);
  const letter = (i: number) => (isSentence ? OPTION_LETTERS[i] : undefined);
  /** 2부분: 어느 빈칸에도 쓰이지 않는 보기 */
  const leftover = isSentence ? choices.findIndex((_, i) => !set.blanks.some((b) => b.answer === i)) : -1;

  return (
    <SelectToVocab className="space-y-5">
      <SetHeader set={set} right={<Button variant="ghost" size="sm" onClick={onHome}>독해 홈</Button>} />

      {/* 점수 */}
      <Card className={cn("overflow-hidden", perfect ? "border-success/40" : "")}>
        <CardBody className="flex flex-wrap items-center gap-5">
          <div className="flex items-baseline gap-1">
            <span className={cn("text-[2.75rem] font-semibold leading-none tracking-tight tabular", perfect ? "text-success" : "text-foreground")}>
              {correct}
            </span>
            <span className="text-title font-medium text-subtle">/ {graded.length}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-heading font-semibold">
              {perfect ? "모두 맞혔어요" : mode === "retry" ? `${correct}개를 다시 맞혔어요` : `${graded.length - correct}개를 오답노트에 담았어요`}
            </p>
            <p className="text-caption text-muted">
              {duration != null && `${mmss(duration)} 걸림 · `}
              {mode === "retry"
                ? "맞힌 빈칸은 다음 복습이 뒤로 밀리고, 틀린 빈칸은 내일 다시 나와요."
                : perfect
                  ? "해설로 근거까지 한 번 더 확인해 보세요."
                  : "틀린 빈칸은 내일 오답노트에서 다시 풀 수 있어요."}
            </p>
          </div>
          {onNext && (
            <Button onClick={onNext}>
              다음 세트 <ArrowRight className="size-4" />
            </Button>
          )}
        </CardBody>
      </Card>

      {/* 정답을 채운 지문 */}
      <Card>
        <CardBody className="space-y-4">
          <Passage
            set={set}
            render={(no) => {
              const b = set.blanks.find((x) => x.no === no)!;
              const g = graded.find((x) => x.no === no);
              if (!g) return <BlankChip no={no} word={text(b, b.answer)} letter={letter(b.answer)} wide={isSentence} tone="given" />;
              if (g.correct) return <BlankChip no={no} word={text(b, b.answer)} letter={letter(b.answer)} wide={isSentence} tone="right" />;
              // 2부분은 문장이 길어 내 답은 기호만, 정답은 문장으로
              return (
                <span className="inline">
                  <BlankChip no={no} word={isSentence ? OPTION_LETTERS[g.selected] : text(b, g.selected)} tone="wrong" />
                  <span lang="zh-CN" className="font-semibold text-success">
                    {isSentence && <span className="mr-1 text-[0.75rem] font-bold">{OPTION_LETTERS[b.answer]}</span>}
                    {text(b, b.answer)}
                  </span>
                </span>
              );
            }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowKo((v) => !v)} aria-expanded={showKo}>
              <Languages className="size-3.5" /> {showKo ? "해석 접기" : "지문 해석 보기"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} className="ml-auto text-subtle">
              <Flag className="size-3.5" /> 정답이 이상해요
            </Button>
          </div>
          {showKo && (
            <p className="rounded-lg bg-surface-2 px-4 py-3 text-body leading-relaxed text-foreground/90 animate-fade-in">
              {set.translation_ko}
            </p>
          )}
          <SelectHint />
        </CardBody>
      </Card>

      {/* 문항별 해설 */}
      <ol className="space-y-3">
        {set.blanks.filter((b) => gradedNos.has(b.no)).map((b) =>
          isSentence ? (
            <SentenceReview key={b.no} set={set} blank={b} graded={graded.find((g) => g.no === b.no)!} />
          ) : (
            <BlankReview key={b.no} set={set} blank={b} graded={graded.find((g) => g.no === b.no)!} selected={selected[String(b.no)]} />
          ),
        )}
        {leftover >= 0 && (
          <li className="surface-card border-dashed px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Badge>남는 보기</Badge>
              <span className="text-micro font-bold text-subtle">{OPTION_LETTERS[leftover]}</span>
            </div>
            <p lang="zh-CN" data-zh-context className="mt-2 text-[1.0625rem] font-medium leading-relaxed">{choices[leftover].text}</p>
            <p data-zh-context className="mt-1 text-caption leading-relaxed text-muted">{choices[leftover].note}</p>
          </li>
        )}
      </ol>

      <div className="flex justify-center gap-2 pt-2">
        <Button variant="secondary" onClick={onHome}>
          <NotebookPen className="size-4" /> 오답노트 보기
        </Button>
        {onNext && (
          <Button onClick={onNext}>
            다음 세트 <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="이 세트를 신고할까요?"
        description="정답이 둘이거나 해설이 틀린 세트는 빼 둡니다. 오답노트와 기록에서도 사라집니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>취소</Button>
            <Button
              variant="danger"
              loading={report.isPending}
              onClick={() =>
                report.mutate(
                  { id: set.id, level: set.level },
                  {
                    onSuccess: () => {
                      setConfirm(false);
                      toast.push({ tone: "success", title: "신고했어요. 이 세트는 더 나오지 않아요" });
                      onHome();
                    },
                    onError: (e) => toast.push({ tone: "error", title: "신고하지 못했습니다", description: e.message }),
                  },
                )
              }
            >
              신고
            </Button>
          </>
        }
      />
    </SelectToVocab>
  );
}

function BlankReview({ set, blank: b, graded: g, selected }: { set: HskSetRow; blank: HskBlank; graded: HskGraded; selected: number }) {
  const context = sentenceWithBlank(set.passage, b.no, (n) => {
    const x = set.blanks.find((y) => y.no === n)!;
    return x.options[x.answer];
  });
  return (
    <li className={cn("surface-card overflow-hidden", !g.correct && "border-danger/30")}>
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className={cn(
          "flex size-6 items-center justify-center rounded-full text-micro font-bold tabular",
          g.correct ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}>
          {b.no}
        </span>
        <Badge>{HSK_KIND_LABEL[b.kind]}</Badge>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-caption font-semibold", g.correct ? "text-success" : "text-danger")}>
          {g.correct ? <Check className="size-4" /> : <X className="size-4" />}
          {g.correct ? "정답" : "오답"}
        </span>
      </div>
      <p data-zh-context className="mx-4 mt-3 border-l-2 border-accent/50 pl-3 text-body leading-relaxed text-foreground/90">{b.explanation}</p>
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {b.options.map((o, i) => {
          const isAnswer = i === b.answer;
          const isMine = i === selected;
          return (
            <li key={i} className={cn("flex items-start gap-3 px-4 py-2.5", isAnswer && "bg-success-soft/40", isMine && !isAnswer && "bg-danger-soft/40")}>
              <span className="mt-0.5 w-4 text-micro font-bold text-subtle">{OPTION_LETTERS[i]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span lang="zh-CN" className="text-[1.0625rem] font-semibold">{o}</span>
                  {isAnswer && <Badge tone="success">정답</Badge>}
                  {isMine && !isAnswer && <Badge tone="danger">내 선택</Badge>}
                </div>
                <p data-zh-context className="mt-0.5 text-caption leading-relaxed text-muted">{b.option_notes[i]}</p>
              </div>
              <AddWord word={o} context={context} />
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** 보기 단어를 단어장에: 기존 AI 카드 생성을 그대로 쓰고, 빈칸이 있던 문장을 문맥으로 */
function AddWord({ word, context }: { word: string; context: string }) {
  const vocab = useZhVocab();
  const add = useAddZhVocab();
  const jobs = useZhVocabJobs();
  const saved = vocab.data?.some((v) => v.hanzi === word);
  const pending = jobs.some((j) => j.status === "pending" && j.text === word);
  return (
    <button
      type="button"
      onClick={() => add.mutate({ text: word, context })}
      disabled={saved || pending}
      title={saved ? "단어장에 있음" : "단어장에 추가"}
      aria-label={saved ? `${word} 단어장에 있음` : `${word} 단어장에 추가`}
      className={cn(
        "mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-micro font-semibold transition-colors",
        saved
          ? "border-transparent bg-accent-soft text-accent"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground disabled:opacity-60",
      )}
    >
      {pending ? <Spinner className="size-3.5" /> : saved ? <BookmarkCheck className="size-3.5" /> : <BookmarkPlus className="size-3.5" />}
      <span className="hidden sm:inline">{saved ? "단어장에 있음" : pending ? "만드는 중" : "단어장"}</span>
    </button>
  );
}

/* ───────── 2부분 · 문장 고르기 ───────── */

/** 보기 6개(A~F)를 한 판에. 고르면 지금 빈칸에 들어가고, 이미 쓴 보기는 몇 번에 썼는지 보인다 */
function SentenceBoard({
  choices,
  active,
  picked,
  targets,
  given,
  onChoose,
}: {
  choices: HskChoice[];
  active: number;
  picked: Record<number, number>;
  targets: number[];
  /** 다시 풀기에서 정답으로 채워 둔 빈칸 */
  given: Array<{ no: number; idx: number }>;
  onChoose: (i: number) => void;
}) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-caption text-muted">
          <span className="mr-1 inline-flex size-5 items-center justify-center rounded-full bg-accent text-micro font-bold text-accent-foreground tabular">
            {active}
          </span>
          번 빈칸에 들어갈 문장을 고르세요 · 1개는 남아요
        </p>
        <ul className="space-y-1.5">
          {choices.map((c, i) => {
            const usedBy = targets.find((no) => picked[no] === i);
            const fixed = given.find((g) => g.idx === i);
            const on = usedBy === active;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onChoose(i)}
                  disabled={!!fixed}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    on
                      ? "border-transparent bg-primary text-primary-foreground"
                      : usedBy !== undefined || fixed
                        ? "border-border bg-surface-2/60 text-muted"
                        : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
                    fixed && "opacity-50",
                  )}
                >
                  <span className={cn("mt-0.5 w-4 shrink-0 text-caption font-bold", on ? "opacity-80" : "text-subtle")}>
                    {OPTION_LETTERS[i]}
                  </span>
                  <span lang="zh-CN" className="flex-1 text-[1.0625rem] leading-relaxed">{c.text}</span>
                  {(usedBy !== undefined || fixed) && !on && (
                    <span className="mt-1 shrink-0 rounded-full bg-surface px-1.5 text-micro font-semibold tabular text-subtle">
                      {usedBy ?? fixed!.no}번
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function SentenceReview({ set, blank: b, graded: g }: { set: HskSetRow; blank: HskBlank; graded: HskGraded }) {
  const choices = set.choices ?? [];
  const row = (i: number, tag: React.ReactNode, tone: "right" | "wrong") => (
    <div className={cn("px-4 py-3", tone === "right" ? "bg-success-soft/40" : "bg-danger-soft/40")}>
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-bold text-subtle">{OPTION_LETTERS[i]}</span>
        {tag}
      </div>
      <p lang="zh-CN" data-zh-context className="mt-1 text-[1.0625rem] font-medium leading-relaxed">{choices[i]?.text}</p>
      <p data-zh-context className="mt-1 text-caption leading-relaxed text-muted">{choices[i]?.note}</p>
    </div>
  );
  return (
    <li className={cn("surface-card overflow-hidden", !g.correct && "border-danger/30")}>
      <div className="flex items-center gap-2 px-4 py-3">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-micro font-bold tabular",
            g.correct ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
          )}
        >
          {b.no}
        </span>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-caption font-semibold", g.correct ? "text-success" : "text-danger")}>
          {g.correct ? <Check className="size-4" /> : <X className="size-4" />}
          {g.correct ? "정답" : "오답"}
        </span>
      </div>
      <div className="divide-y divide-border border-t border-border">
        {row(b.answer, <Badge tone="success">정답</Badge>, "right")}
        {!g.correct && row(g.selected, <Badge tone="danger">내 선택</Badge>, "wrong")}
      </div>
    </li>
  );
}

/* ───────── 공통 ───────── */

function SetHeader({ set, right, badge }: { set: HskSetRow; right?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">HSK {set.level}급</Badge>
          <Badge>{set.topic}</Badge>
          {set.origin === "similar" && <Badge tone="warning">비슷한 문제</Badge>}
          {badge}
        </div>
        <h2 lang="zh-CN" className="mt-1.5 text-title font-semibold tracking-tight">{set.title}</h2>
      </div>
      {right}
    </div>
  );
}

function Passage({ set, render }: { set: HskSetRow; render: (no: number) => React.ReactNode }) {
  return (
    <p data-zh-context lang="zh-CN" className="whitespace-pre-line text-[1.125rem] leading-[2.2] tracking-wide text-foreground/95">
      {splitPassage(set.passage).map((part, i) =>
        typeof part === "number" ? <React.Fragment key={i}>{render(part)}</React.Fragment> : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </p>
  );
}

function BlankChip({
  no,
  word,
  letter,
  wide,
  tone,
  onClick,
}: {
  no: number;
  word?: string;
  /** 2부분: 고른 보기 기호 */
  letter?: string;
  /** 2부분: 문장이 들어가는 넓은 빈칸 (줄바꿈 허용) */
  wide?: boolean;
  tone: "empty" | "active" | "picked" | "given" | "right" | "wrong";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "mx-0.5 rounded-md border-b-2 px-1.5 align-baseline transition-colors",
        wide && word ? "inline box-decoration-clone py-0.5 text-left" : "inline-flex items-baseline gap-1",
        tone === "empty" && "border-border-strong bg-surface-2 text-subtle",
        tone === "active" && "border-accent bg-accent-soft text-accent",
        tone === "picked" && "border-foreground/60 bg-surface-2 text-foreground",
        tone === "given" && "border-transparent text-foreground/60",
        tone === "right" && "border-success bg-success-soft text-success",
        tone === "wrong" && "border-danger bg-danger-soft text-danger line-through decoration-2",
      )}
    >
      <span className="mr-1 text-[0.7rem] font-bold not-italic tabular opacity-70">{no}</span>
      {letter && <span className="mr-1 text-[0.75rem] font-bold">{letter}</span>}
      <span className={cn(wide && word ? "font-medium" : "font-semibold")}>
        {word ?? (wide ? "\u3000\u3000\u3000\u3000\u3000\u3000" : "\u3000\u3000\u3000")}
      </span>
    </Tag>
  );
}

/** 드래그로 단어장에 넣을 수 있다는 안내 */
function SelectHint() {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-micro text-subtle">
      <BookmarkPlus className="size-3.5" />
      모르는 단어는 드래그해서 단어장에 넣을 수 있어요 <span className="[@media(hover:hover)]:hidden">(길게 눌러 선택)</span>
    </p>
  );
}
