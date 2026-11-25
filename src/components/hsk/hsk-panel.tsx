"use client";

import * as React from "react";
import { BookOpenCheck, ChevronRight, NotebookPen, RefreshCw, Shuffle, Sparkles, Target } from "lucide-react";
import type { HskAttemptWithSet, HskGraded, HskSetRow, HskWrongWithSet } from "@/lib/types";
import { HSK_LEVELS, HSK_OPEN_LEVELS, HSK_PART_LIST, HSK_PARTS, HSK_POOL_TARGET, HSK_TOPICS, OPTION_LETTERS, type HskPart } from "@/lib/hsk";
import { cn, relativeDayLabel, todayKey } from "@/lib/utils";
import { dueLabel } from "@/lib/zh-review";
import {
  returnHskToPool,
  useGenerateHsk,
  useHskRefilling,
  useHskSummary,
  useTakeHskSet,
  useToday,
} from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTitle } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { StatTile } from "@/components/ui/stat-tile";
import { useToast } from "@/components/ui/toast";
import { HskResult, HskSolve } from "./hsk-solve";
import { ReadingResult, ReadingSolve } from "./hsk-reading";
import { HskGenerating } from "./hsk-generating";

type View =
  | { kind: "home" }
  | { kind: "generating"; similar: boolean }
  | { kind: "solve"; set: HskSetRow; mode: "first" | "retry"; retryNos?: number[] }
  | {
      kind: "result";
      set: HskSetRow;
      mode: "first" | "retry";
      selected: Record<string, number>;
      graded: HskGraded[];
      duration: number | null;
      /** 지난 기록을 다시 볼 때는 "다음 세트"를 숨긴다 */
      review?: boolean;
    };

const LEVEL = 6;
const PART_KEY = "daily:hsk-part";

/** 중국어 페이지 · 독해 탭 */
export function HskPanel({ aiAvailable }: { aiAvailable: boolean }) {
  const toast = useToast();
  const summary = useHskSummary(LEVEL);
  const take = useTakeHskSet();
  const generate = useGenerateHsk();
  // 풀 채우기는 따로: 바로 풀 세트를 만드는 요청과 섞이지 않게
  const refill = useGenerateHsk();
  const [part, setPart] = React.useState<HskPart>(1);
  const refilling = useHskRefilling(part);
  const [view, setView] = React.useState<View>({ kind: "home" });
  const [topic, setTopic] = React.useState<string | null>(null);

  // 마지막으로 고른 부분 (기기별)
  React.useEffect(() => {
    try {
      const v = Number(localStorage.getItem(PART_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v in HSK_PARTS) setPart(v as HskPart);
    } catch {}
  }, []);
  function changePart(p: HskPart) {
    setPart(p);
    try {
      localStorage.setItem(PART_KEY, String(p));
    } catch {}
  }
  const topRef = React.useRef<HTMLDivElement>(null);
  /** 지금 기다리는 생성 요청. 돌아가기를 누르면 바뀌어서, 늦게 끝난 결과가 화면을 덮지 않는다 */
  const waiting = React.useRef(0);

  const go = (v: View) => {
    setView(v);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  /** 풀이 모자라면 백그라운드로 하나씩 채운다 (주제는 랜덤) */
  const pool = summary.data ? (summary.data.pools[part] ?? 0) : undefined;
  React.useEffect(() => {
    // 한 번 실패하면 이 화면에서는 다시 시도하지 않는다 (같은 오류로 계속 부르지 않게)
    if (!aiAvailable || pool === undefined || refill.isError) return;
    if (pool + refilling < HSK_POOL_TARGET && refilling === 0) {
      refill.mutate({ level: LEVEL, part, serve: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAvailable, pool, part, refilling, refill.isError]);

  async function start() {
    let ticket = -1;
    try {
      const set = await take.mutateAsync({ level: LEVEL, part, topic });
      if (set) return go({ kind: "solve", set, mode: "first" });
      go({ kind: "generating", similar: false });
      ticket = ++waiting.current;
      const fresh = await generate.mutateAsync({ level: LEVEL, part, topic, serve: true });
      if (ticket !== waiting.current) return void returnHskToPool(fresh.id).then(() => summary.refetch());
      go({ kind: "solve", set: fresh, mode: "first" });
    } catch (e) {
      if (ticket !== -1 && ticket !== waiting.current) return;
      go({ kind: "home" });
      toast.push({ tone: "error", title: "문제를 준비하지 못했습니다", description: e instanceof Error ? e.message : undefined });
    }
  }

  /** 비슷한 문제: 1부분은 틀린 단어를 정답으로, 2부분은 같은 주제·형식으로 새로 */
  async function similar(set: HskSetRow, words: string[]) {
    go({ kind: "generating", similar: true });
    const ticket = ++waiting.current;
    try {
      const fresh = await generate.mutateAsync({
        level: set.level,
        part: set.part,
        topic: set.topic,
        ...(set.part === 1 ? { focus_words: words } : { similar: true }),
        serve: true,
      });
      if (ticket !== waiting.current) return void returnHskToPool(fresh.id).then(() => summary.refetch());
      go({ kind: "solve", set: fresh, mode: "first" });
    } catch (e) {
      if (ticket !== waiting.current) return;
      go({ kind: "home" });
      toast.push({ tone: "error", title: "비슷한 문제를 만들지 못했습니다", description: e instanceof Error ? e.message : undefined });
    }
  }

  // 3부분은 지문과 문항을 나란히 두도록 넓은 화면에서 양옆으로 조금 더 쓴다
  const wide = (view.kind === "solve" || view.kind === "result") && view.set.part === 3;

  return (
    <div ref={topRef} className={cn("scroll-mt-6", wide && "lg:-mx-12 xl:-mx-32")}>
      {view.kind === "generating" ? (
        <HskGenerating
          similar={view.similar}
          onCancel={() => {
            waiting.current++;
            go({ kind: "home" });
          }}
        />
      ) : view.kind === "solve" ? (
        React.createElement(view.set.part === 3 ? ReadingSolve : HskSolve, {
          key: `${view.set.id}:${view.mode}`,
          set: view.set,
          mode: view.mode,
          retryNos: view.retryNos,
          onQuit: () => go({ kind: "home" }),
          onDone: (r) => go({ kind: "result", set: view.set, mode: view.mode, ...r }),
        })
      ) : view.kind === "result" ? (
        React.createElement(view.set.part === 3 ? ReadingResult : HskResult, {
          set: view.set,
          mode: view.mode,
          selected: view.selected,
          graded: view.graded,
          duration: view.duration,
          onHome: () => go({ kind: "home" }),
          onNext: view.review ? undefined : start,
        })
      ) : (
        <Home
          loading={summary.isPending}
          data={summary.data}
          topic={topic}
          onTopic={setTopic}
          onStart={start}
          starting={take.isPending}
          refilling={refilling > 0}
          aiAvailable={aiAvailable}
          onRetry={(w) =>
            go({ kind: "solve", set: w.set, mode: "retry", retryNos: w.items.map((i) => i.blank_no) })
          }
          part={part}
          onPart={changePart}
          onSimilar={(w) =>
            similar(
              w.set,
              w.set.part === 1 ? w.items.map((i) => w.set.blanks.find((b) => b.no === i.blank_no)!.options[i.answer]) : [],
            )
          }
          onOpenRecent={(a) =>
            go({
              kind: "result",
              set: a.hsk_sets,
              mode: "first",
              selected: a.selected,
              graded: a.hsk_sets.blanks.map((b) => ({
                no: b.no,
                selected: a.selected[String(b.no)],
                answer: b.answer,
                correct: a.selected[String(b.no)] === b.answer,
              })),
              duration: a.duration_sec,
              review: true,
            })
          }
        />
      )}
    </div>
  );
}

/* ───────── 첫 화면 ───────── */

interface WrongGroup {
  set: HskSetRow;
  items: HskWrongWithSet[];
  /** 가장 이른 복습일 */
  due: string | null;
}

function groupWrong(rows: HskWrongWithSet[]): WrongGroup[] {
  const map = new Map<string, WrongGroup>();
  for (const w of rows) {
    const g = map.get(w.set_id) ?? { set: w.hsk_sets, items: [], due: null };
    g.items.push(w);
    if (w.due_on && (!g.due || w.due_on < g.due)) g.due = w.due_on;
    map.set(w.set_id, g);
  }
  return [...map.values()].sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
}

function Home({
  part,
  onPart,
  loading,
  data,
  topic,
  onTopic,
  onStart,
  starting,
  refilling,
  aiAvailable,
  onRetry,
  onSimilar,
  onOpenRecent,
}: {
  part: HskPart;
  onPart: (p: HskPart) => void;
  loading: boolean;
  data: ReturnType<typeof useHskSummary>["data"];
  topic: string | null;
  onTopic: (t: string | null) => void;
  onStart: () => void;
  starting: boolean;
  refilling: boolean;
  aiAvailable: boolean;
  onRetry: (g: WrongGroup) => void;
  onSimilar: (g: WrongGroup) => void;
  onOpenRecent: (a: HskAttemptWithSet) => void;
}) {
  const today = useToday() ?? todayKey();
  const groups = React.useMemo(() => groupWrong(data?.wrong ?? []), [data?.wrong]);
  const dueGroups = groups.filter((g) => g.due && g.due <= today);
  const later = groups.filter((g) => !g.due || g.due > today);
  const accuracy = data?.stats.total ? Math.round((data.stats.correct / data.stats.total) * 100) : null;

  return (
    <div className="space-y-8">
      {/* 시작 카드 */}
      <Card className="overflow-hidden">
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <BookOpenCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-heading font-semibold">HSK 독해 · {HSK_PARTS[part].label}</p>
              <p className="text-caption text-muted">
                {HSK_PARTS[part].desc}. 제출하면 바로 채점하고 보기마다 왜 맞고 틀린지 알려 줘요.
              </p>
            </div>
          </div>

          <Segmented<string>
            value={String(part)}
            onChange={(v) => onPart(Number(v) as HskPart)}
            fullWidth
            options={HSK_PART_LIST.map((p) => ({
              value: String(p),
              label: (
                <span className="flex flex-col items-center leading-tight sm:flex-row sm:gap-1">
                  <span className="text-micro opacity-70 sm:text-caption sm:opacity-100">{HSK_PARTS[p].short}</span>
                  <span className="hidden sm:inline">·</span>
                  <span>{HSK_PARTS[p].label}</span>
                </span>
              ),
            }))}
          />

          <div className="space-y-2">
            <p className="text-caption font-medium text-muted">급수</p>
            <div className="flex flex-wrap gap-1.5">
              {HSK_LEVELS.map((l) => {
                const open = HSK_OPEN_LEVELS.includes(l);
                return (
                  <Chip key={l} size="sm" selected={l === LEVEL} disabled={!open} title={open ? undefined : "준비 중"} className={cn(!open && "opacity-40")}>
                    {l}급
                  </Chip>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-caption font-medium text-muted">주제</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip size="sm" selected={topic === null} onClick={() => onTopic(null)}>
                <Shuffle className="size-3.5" /> 랜덤
              </Chip>
              {HSK_TOPICS.map((t) => (
                <Chip key={t} size="sm" selected={topic === t} onClick={() => onTopic(topic === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p className="flex-1 text-caption text-subtle">
              {loading ? (
                "준비된 세트 확인 중…"
              ) : (
                <>
                  준비된 세트 <b className="tabular text-foreground">{data?.pools[part] ?? 0}</b>개
                  {refilling && <span className="ml-1.5 text-accent">· 하나 더 만드는 중</span>}
                  {topic && <span className="ml-1.5">· {topic} 주제는 없으면 새로 만들어요</span>}
                </>
              )}
            </p>
            <Button onClick={onStart} loading={starting} disabled={!aiAvailable && !data?.pools[part]} size="lg">
              <Sparkles className="size-4" /> 문제 풀기
            </Button>
          </div>
          {!aiAvailable && <p className="text-caption text-warning">OPENAI_API_KEY 가 설정되지 않아 새 문제를 만들 수 없습니다.</p>}
        </CardBody>
      </Card>

      {/* 누적 */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="푼 세트" value={data?.stats.sets ?? 0} unit="개" />
        <StatTile label="정답률" value={accuracy ?? "–"} unit={accuracy == null ? undefined : "%"} />
        <StatTile label="오답노트" value={data?.wrong.length ?? 0} unit="문항" hint={dueGroups.length ? `오늘 ${dueGroups.reduce((a, g) => a + g.items.length, 0)}문항` : undefined} />
      </div>

      {/* 오답노트 */}
      <section className="space-y-3">
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <NotebookPen className="size-3.5" /> 오답노트
          </span>
        </SectionTitle>
        {loading ? (
          <Skeleton className="h-24" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Target className="size-5" />}
            title="오답노트가 비어 있어요"
            description="틀린 빈칸은 여기에 쌓이고, 내일 → 3일 → 1주 간격으로 다시 풀게 돼요. 세 번 맞히면 졸업."
          />
        ) : (
          <ul className="space-y-2">
            {[...dueGroups, ...later].map((g) => (
              <WrongCard key={g.set.id} group={g} today={today} onRetry={() => onRetry(g)} onSimilar={() => onSimilar(g)} aiAvailable={aiAvailable} />
            ))}
          </ul>
        )}
      </section>

      {/* 최근 푼 세트 */}
      {(data?.recent.length ?? 0) > 0 && (
        <section className="space-y-3">
          <SectionTitle>최근 푼 세트</SectionTitle>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {data!.recent.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpenRecent(a)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "flex h-7 min-w-11 items-center justify-center rounded-full px-2 text-caption font-semibold tabular",
                      a.correct === a.total ? "bg-success-soft text-success" : "bg-surface-2 text-foreground",
                    )}
                  >
                    {a.correct}/{a.total}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p lang="zh-CN" className="truncate text-body font-medium">{a.hsk_sets.title}</p>
                    <p className="text-micro text-subtle">
                      {HSK_PARTS[a.hsk_sets.part as HskPart]?.short} · {a.hsk_sets.topic} ·{" "}
                      {relativeDayLabel(todayKey(new Date(a.created_at)), today)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WrongCard({
  group: g,
  today,
  onRetry,
  onSimilar,
  aiAvailable,
}: {
  group: WrongGroup;
  today: string;
  onRetry: () => void;
  onSimilar: () => void;
  aiAvailable: boolean;
}) {
  const due = g.due && g.due <= today;
  return (
    <li className={cn("surface-card px-4 py-3.5", due && "border-accent/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{HSK_PARTS[g.set.part as HskPart]?.short ?? `${g.set.part}부분`}</Badge>
        <p lang="zh-CN" className="min-w-0 flex-1 truncate text-body font-semibold">{g.set.title}</p>
        <Badge tone={due ? "accent" : "neutral"}>
          {due ? "오늘 복습" : g.due ? dueLabel(g.due, today) : "복습 예정"}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {g.items.map((w) => {
          const b = g.set.blanks.find((x) => x.no === w.blank_no)!;
          // 2부분은 보기 문장이 길어 글자 대신 A~F 와 정답 문장 앞부분
          // 1부분은 단어 그대로, 2·3부분은 보기가 길어 A~F 와 정답 문장(문항) 앞부분
          const choice = (i: number) => (g.set.part === 1 ? b.options[i] : OPTION_LETTERS[i]);
          const snippet = g.set.part === 2 ? g.set.choices?.[w.answer]?.text : g.set.part === 3 ? b.stem : null;
          return (
            <span key={w.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-caption">
              <span className="font-bold tabular text-subtle">{w.blank_no}</span>
              <span lang="zh-CN" className="text-danger line-through decoration-danger/60">{choice(w.selected)}</span>
              <span className="text-subtle">→</span>
              <span lang="zh-CN" className="font-semibold text-success">{choice(w.answer)}</span>
              {snippet && <span lang="zh-CN" className="min-w-0 truncate text-muted">{snippet}</span>}
              {w.stage > 0 && <span className="shrink-0 text-micro text-subtle">· {w.stage}/3</span>}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSimilar}
          disabled={!aiAvailable}
          title={g.set.part === 1 ? "틀린 단어를 정답으로 쓰는 새 세트" : "같은 주제·형식의 새 세트"}
        >
          <RefreshCw className="size-3.5" /> 비슷한 문제
        </Button>
        <Button variant={due ? "accent" : "secondary"} size="sm" onClick={onRetry}>
          다시 풀기
        </Button>
      </div>
    </li>
  );
}
