"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { EMOTION_META, type Emotion } from "@/lib/constants";
import { addDaysKey, cn, formatDateKo, weekStartKey } from "@/lib/utils";
import type { EmotionInsightResponse, EntryWithTags } from "@/lib/types";
import { useEmotionInsight, useGenerateEmotionInsight } from "@/lib/query/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Insight = Extract<EmotionInsightResponse, { status: "ok" }>["insight"];

/**
 * 주간 감정 분포 + 감정별 "무엇이 이 감정을 만들었나".
 * - 분포·함께 기록된 사건/스트레스는 기록 캐시에서 바로 계산
 * - AI 요인 분석은 감정을 처음 펼칠 때 그 주를 한 번 분석해 저장 (이후엔 저장본)
 */
export function EmotionInsightCard({ entries, today }: { entries: EntryWithTags[]; today: string }) {
  const thisWeek = weekStartKey(today);
  const [week, setWeek] = React.useState(thisWeek);
  const [open, setOpen] = React.useState<string | null>(null);
  const weekEnd = addDaysKey(week, 6);

  const weekEntries = React.useMemo(
    () => entries.filter((e) => !e.risk_flag && e.entry_date >= week && e.entry_date <= weekEnd),
    [entries, week, weekEnd],
  );

  const rows = React.useMemo(() => {
    const m = new Map<string, EntryWithTags[]>();
    for (const e of weekEntries)
      for (const t of e.entry_tags)
        if (t.kind === "emotion") (m.get(t.value) ?? m.set(t.value, []).get(t.value)!).push(e);
    return [...m.entries()].map(([emotion, list]) => ({ emotion, entries: list })).sort((a, b) => b.entries.length - a.entries.length);
  }, [weekEntries]);
  const sum = rows.reduce((a, r) => a + r.entries.length, 0);

  const query = useEmotionInsight(week, rows.length > 0);
  const generate = useGenerateEmotionInsight();
  const data = query.data;
  const status = data?.status;
  const insight = data?.status === "ok" ? data.insight : null;
  const stale = data?.status === "ok" && data.stale;
  const generating = generate.isPending && generate.variables === week;

  // 감정을 처음 펼쳤는데 그 주 분석이 아직 없으면 자동으로 한 번 만든다
  const autoRequested = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!open || status !== "none" || autoRequested.current.has(week)) return;
    autoRequested.current.add(week);
    generate.mutate(week);
  }, [open, status, week, generate]);

  function moveWeek(delta: number) {
    setWeek((w) => addDaysKey(w, delta * 7));
    setOpen(null);
  }

  const label =
    week === thisWeek ? "이번 주" : week === addDaysKey(thisWeek, -7) ? "지난주" : null;

  return (
    <Card>
      <CardHeader
        title="감정 분포"
        description="감정을 누르면 그 감정을 만든 요인을 보여줍니다 · 주 단위 AI 분석"
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="이전 주" onClick={() => moveWeek(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[8.5rem] text-center text-caption tabular text-muted">
              {formatDateKo(week, "M.d")} – {formatDateKo(weekEnd, "M.d")}
              {label && <span className="ml-1 text-foreground">· {label}</span>}
            </span>
            <Button variant="ghost" size="icon" aria-label="다음 주" onClick={() => moveWeek(1)} disabled={week >= thisWeek}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-4 pt-4">
        {rows.length === 0 ? (
          <p className="text-caption text-muted">
            {weekEntries.length === 0 ? "이 주에는 기록이 없습니다." : "이 주에는 감정 태그가 없습니다."}
          </p>
        ) : (
          <>
            <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md">
              {rows.map((r) => (
                <button
                  key={r.emotion}
                  type="button"
                  className="h-full transition-opacity hover:opacity-80"
                  style={{ width: `${(r.entries.length / sum) * 100}%`, background: colorOf(r.emotion) }}
                  title={`${r.emotion} ${r.entries.length}`}
                  aria-label={`${r.emotion} 요인 보기`}
                  onClick={() => setOpen((o) => (o === r.emotion ? null : r.emotion))}
                />
              ))}
            </div>

            {insight?.content_json.overview && (
              <p className="flex gap-2 rounded-md bg-surface-2/60 px-3 py-2.5 text-caption leading-relaxed">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
                {insight.content_json.overview}
              </p>
            )}

            {stale && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-caption text-muted">
                <span>분석 뒤로 기록이 바뀌었어요.</span>
                <Button variant="ghost" size="sm" loading={generating} onClick={() => generate.mutate(week)}>
                  {!generating && <RefreshCw className="size-3.5" />} 새 기록 반영해서 다시 분석
                </Button>
              </div>
            )}

            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((r) => {
                const isOpen = open === r.emotion;
                return (
                  <li key={r.emotion}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : r.emotion)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <span className="flex items-center gap-2 text-body font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: colorOf(r.emotion) }} />
                        {r.emotion}
                      </span>
                      <span className="flex items-center gap-2 text-caption tabular text-muted">
                        {r.entries.length}회 · {Math.round((r.entries.length / sum) * 100)}%
                        <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                      </span>
                    </button>
                    {isOpen && (
                      <EmotionDetail
                        emotion={r.emotion}
                        entries={r.entries}
                        insight={insight}
                        state={
                          query.isPending || generating
                            ? "loading"
                            : generate.isError && generate.variables === week && !insight
                              ? "error"
                              : query.isError
                                ? "error"
                                : status === "no_ai"
                                  ? "no_ai"
                                  : "ready"
                        }
                        errorMessage={(generate.error ?? query.error)?.message}
                        onRetry={() => (query.isError ? void query.refetch() : generate.mutate(week))}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** 받침이 있으면 "을", 없으면 "를" (평온을 · 슬픔을 · 무기력을 / 기쁨을) */
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 === 0 ? "를" : "을";
}

function colorOf(emotion: string) {
  return EMOTION_META[emotion as Emotion]?.color ?? "var(--fg-subtle)";
}

/** 그 감정이 태그된 기록에 함께 붙은 사건·스트레스 원인 (AI 없이 바로) */
function coTags(entries: EntryWithTags[]) {
  const count = new Map<string, number>();
  for (const e of entries)
    for (const t of e.entry_tags)
      if (t.kind === "event" || t.kind === "stressor") {
        const v = t.value.trim();
        if (v) count.set(v, (count.get(v) ?? 0) + 1);
      }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function EmotionDetail({
  emotion,
  entries,
  insight,
  state,
  errorMessage,
  onRetry,
}: {
  emotion: string;
  entries: EntryWithTags[];
  insight: Insight | null;
  state: "loading" | "error" | "no_ai" | "ready";
  errorMessage?: string;
  onRetry: () => void;
}) {
  const tags = coTags(entries);
  const item = insight?.content_json.emotions.find((e) => e.emotion === emotion);

  return (
    <div className="space-y-4 border-t border-border bg-surface-2/30 px-4 py-4">
      {tags.length > 0 && (
        <div>
          <p className="text-micro font-semibold text-subtle">함께 기록된 사건·스트레스</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map(([v, n]) => (
              <span key={v} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-micro font-medium text-muted">
                {v}
                {n > 1 && <span className="ml-1 text-subtle">{n}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="flex items-center gap-1.5 text-micro font-semibold text-accent">
          <Sparkles className="size-3.5" /> {emotion}{objectParticle(emotion)} 만든 요인
        </p>
        {state === "loading" ? (
          <div className="mt-2 space-y-2" aria-busy>
            <p className="text-caption text-muted">이 주의 기록을 읽고 요인을 찾는 중… (처음 한 번만 걸려요)</p>
            <div className="h-3 w-4/5 animate-pulse-soft rounded bg-surface-3" />
            <div className="h-3 w-3/5 animate-pulse-soft rounded bg-surface-3" />
          </div>
        ) : state === "error" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-muted">
            <span>분석하지 못했습니다{errorMessage ? `: ${errorMessage}` : "."}</span>
            <Button variant="secondary" size="sm" onClick={onRetry}>다시 시도</Button>
          </div>
        ) : state === "no_ai" ? (
          <p className="mt-2 text-caption text-muted">OPENAI_API_KEY 가 없어 AI 분석을 할 수 없어요.</p>
        ) : !item || item.drivers.length === 0 ? (
          <p className="mt-2 text-caption text-muted">
            {insight ? "이 감정의 요인은 아직 분석되지 않았어요. 새 기록을 반영해 다시 분석해 보세요." : "분석 준비 중입니다."}
          </p>
        ) : (
          <>
            {item.summary && <p className="mt-2 text-body leading-relaxed">{item.summary}</p>}
            <ol className="mt-3 space-y-3">
              {item.drivers.map((d, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
                    style={{ background: colorOf(emotion) }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-medium">{d.factor}</p>
                    {d.detail && <p className="mt-0.5 text-caption text-muted">{d.detail}</p>}
                    {d.evidence.map((ev) => (
                      <Link
                        key={ev.entry_id + ev.quote}
                        href={`/entries/${ev.entry_id}`}
                        className="mt-1.5 block border-l-2 border-border pl-3 text-caption text-muted hover:border-accent hover:text-foreground"
                      >
                        “{ev.quote}” <span className="text-subtle">· {formatDateKo(ev.date, "M/d")}</span>
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
