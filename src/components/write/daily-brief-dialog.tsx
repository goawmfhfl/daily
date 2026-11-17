"use client";

import * as React from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CloudRain, HeartHandshake, Leaf, Lightbulb, Smile } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { formatDateKo } from "@/lib/utils";
import { EMOTION_META, type Emotion } from "@/lib/constants";
import type { BriefItem, BriefResponse } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** "어제의 나" / "11월 14일의 나" */
export function briefTitle(targetDate: string, today: string) {
  const diff = differenceInCalendarDays(parseISO(today), parseISO(targetDate));
  return diff === 1 ? "어제의 나" : `${formatDateKo(targetDate, "M월 d일")}의 나`;
}

export function DailyBriefDialog({
  open,
  onClose,
  today,
  query,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
  query: UseQueryResult<BriefResponse, Error>;
}) {
  const data = query.data;
  const dated = data && data.status !== "none" ? data : null;

  const title = dated ? briefTitle(dated.target_date, today) : "어제의 나";
  const description = dated
    ? `${formatDateKo(dated.target_date, "M월 d일 EEEE")} · 기록 ${dated.entry_ids.length}건`
    : undefined;

  const entriesHref = dated
    ? dated.entry_ids.length === 1
      ? `/entries/${dated.entry_ids[0]}`
      : "/entries"
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-h-[88vh] w-[min(94vw,34rem)] overflow-y-auto"
      footer={
        <>
          {entriesHref && (
            <ButtonLink href={entriesHref} variant="ghost" size="sm" onClick={onClose}>
              그날 기록 보기
            </ButtonLink>
          )}
          <Button size="sm" onClick={onClose}>
            오늘 기록하러 가기
          </Button>
        </>
      }
    >
      {query.isPending ? (
        <BriefSkeleton />
      ) : query.isError ? (
        <div className="space-y-3">
          <p className="text-body text-muted">브리핑을 불러오지 못했습니다.</p>
          <p className="text-caption text-subtle">{query.error.message}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : data?.status === "none" ? (
        <p className="text-body text-muted">
          아직 지난 기록이 없어요. 오늘 첫 기록을 남기면 내일 아침 여기서 돌아볼 수 있어요.
        </p>
      ) : data?.status === "no_ai" ? (
        <p className="text-body text-muted">
          OPENAI_API_KEY 가 설정되지 않아 요약을 만들 수 없어요. 그날 기록은 아래에서 볼 수 있어요.
        </p>
      ) : data?.status === "care" ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg bg-accent-soft/50 p-4">
            <HeartHandshake className="mt-0.5 size-5 shrink-0 text-accent" />
            <p className="text-body leading-relaxed">
              그날은 마음이 많이 힘들었던 것 같아요. 오늘은 분석 대신 안부만 전할게요. 지금은 좀 어떠세요?
            </p>
          </div>
          <Link
            href={`/safety?entry=${data.entry_ids[0]}`}
            onClick={onClose}
            className="inline-block text-caption font-medium text-accent hover:underline"
          >
            이야기할 수 있는 곳 보기 →
          </Link>
        </div>
      ) : data?.status === "ok" ? (
        <BriefBody content={data.brief.content_json} onNavigate={onClose} />
      ) : null}
    </Dialog>
  );
}

function BriefBody({
  content: c,
  onNavigate,
}: {
  content: Extract<BriefResponse, { status: "ok" }>["brief"]["content_json"];
  onNavigate: () => void;
}) {
  const hasStats = c.emotions.length > 0 || c.stress_level || c.energy || c.habits_total > 0;
  return (
    <div className="space-y-6">
      <p className="text-[1.0625rem] leading-relaxed">{c.summary}</p>

      {hasStats && (
        <div className="flex flex-wrap items-center gap-1.5">
          {c.emotions.map((e) => (
            <span
              key={e}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-micro font-semibold"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: EMOTION_META[e as Emotion]?.color ?? "var(--subtle)" }}
              />
              {e}
            </span>
          ))}
          {c.stress_level != null && <Badge>스트레스 {c.stress_level}/5</Badge>}
          {c.energy != null && <Badge>에너지 {c.energy}/5</Badge>}
          {c.habits_total > 0 && (
            <Badge tone={c.habits_done.length > 0 ? "success" : "neutral"}>
              지속 활동 {c.habits_done.length}/{c.habits_total}
            </Badge>
          )}
        </div>
      )}

      <Section
        icon={<Smile className="size-4" />}
        tone="text-[var(--joy)]"
        title="가장 기뻤던 것"
        items={c.joys}
        empty="특별히 기록된 기쁜 일은 없었어요."
        onNavigate={onNavigate}
      />
      <Section
        icon={<CloudRain className="size-4" />}
        tone="text-[var(--anxiety)]"
        title="스트레스받았던 것"
        items={c.stresses}
        empty="스트레스받은 일은 기록되지 않았어요."
        onNavigate={onNavigate}
      />
      <Section
        icon={<Leaf className="size-4" />}
        tone="text-[var(--calm)]"
        title="힐링했던 것"
        items={c.healings}
        empty="쉬어 간 순간은 기록되지 않았어요."
        onNavigate={onNavigate}
      />

      {c.tip && (
        <div className="flex gap-3 rounded-lg border border-accent/25 bg-accent-soft/40 p-4">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <p className="text-micro font-semibold text-accent">오늘을 위한 한마디</p>
            <p className="mt-1 text-body leading-relaxed">{c.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  tone,
  title,
  items,
  empty,
  onNavigate,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  items: BriefItem[];
  empty: string;
  onNavigate: () => void;
}) {
  return (
    <section>
      <h3 className={`flex items-center gap-1.5 text-caption font-semibold ${tone}`}>
        {icon}
        <span className="text-foreground">{title}</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-caption text-subtle">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {items.map((it, i) => (
            <li key={i}>
              <p className="text-body font-medium">{it.title}</p>
              {it.quote &&
                (it.entry_id ? (
                  <Link
                    href={`/entries/${it.entry_id}`}
                    onClick={onNavigate}
                    className="mt-1 block border-l-2 border-border pl-3 text-caption text-muted hover:border-accent hover:text-foreground"
                  >
                    “{it.quote}”
                  </Link>
                ) : (
                  <p className="mt-1 border-l-2 border-border pl-3 text-caption text-muted">“{it.quote}”</p>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <p className="text-caption text-muted">지난 기록을 읽고 정리하는 중…</p>
      <div className="space-y-2">
        <div className="h-4 w-11/12 animate-pulse-soft rounded bg-surface-3" />
        <div className="h-4 w-3/5 animate-pulse-soft rounded bg-surface-3" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 animate-pulse-soft rounded bg-surface-3" />
          <div className="h-3 w-4/5 animate-pulse-soft rounded bg-surface-3" />
        </div>
      ))}
    </div>
  );
}
