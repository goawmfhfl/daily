"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Quote,
  TrendingUp,
  Map,
  LifeBuoy,
  Eye,
  Sun,
  Repeat,
  Footprints,
  GitCompare,
  Flag,
  ChevronDown,
  Check,
  X,
  Activity,
  Clock,
} from "lucide-react";
import { FlowChart, TimeOfDayBars, WeekdayHeatmap } from "@/components/reports/report-charts";
import type { ReportRow, ReportSection, Evidence } from "@/lib/types";
import { PERIODS } from "@/lib/constants";
import { useDeleteReport } from "@/lib/query/hooks";
import { formatDateKo, formatDateTimeKo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function ReportView({
  report,
  previous,
}: {
  report: ReportRow;
  previous: ReportRow | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const c = report.content_json;
  const period = PERIODS.find((p) => p.key === report.period_key);
  const [confirm, setConfirm] = React.useState(false);
  const deleteReport = useDeleteReport();
  const busy = deleteReport.isPending;

  function remove() {
    deleteReport.mutate(report.id, {
      onSuccess: () => {
        toast.push({ tone: "success", title: "리포트를 삭제했습니다" });
        router.push("/reports");
      },
      onError: (e) => toast.push({ tone: "error", title: "삭제 실패", description: e.message }),
    });
  }

  return (
    <article className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-caption text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> 리포트 목록
        </Link>
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} className="text-danger hover:text-danger">
          <Trash2 className="size-3.5" /> 삭제
        </Button>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-caption text-subtle">
          <Badge tone="accent">{period?.label ?? report.period_key}</Badge>
          <span>{report.period_start} ~ {report.period_end}</span>
          <span>· 기록 {report.entry_count}건</span>
          <span>· {formatDateTimeKo(report.created_at)}</span>
          <span className="font-mono">· {report.model}</span>
        </div>
        <h1 className="text-title font-semibold tracking-tight text-balance sm:text-display">
          {c.headline}
        </h1>
      </header>

      {c.comparison_with_previous && (
        <Card className="border-accent/30 bg-accent-soft/40">
          <CardBody className="flex gap-3">
            <GitCompare className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="text-caption font-semibold text-accent">이전 리포트와 달라진 점</p>
              <p className="mt-1 text-body leading-relaxed">{c.comparison_with_previous}</p>
              {previous && (
                <Link href={`/reports/${previous.id}`} className="mt-2 inline-block text-caption text-muted underline-offset-2 hover:underline">
                  이전 리포트 보기 ({formatDateKo(previous.created_at.slice(0, 10), "M월 d일")})
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {c.metrics && (
        <section className="surface-card px-5 py-5 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-muted">
              <Activity className="size-4" />
            </span>
            <h2 className="text-heading font-semibold">{report.period_key === "7d" ? "한 주의 흐름" : "기간의 흐름"}</h2>
            <span className="hidden text-caption text-subtle sm:inline">
              · {c.metrics.granularity === "week" ? "주별" : "날짜별"} 스트레스·에너지와 주 감정
            </span>
          </div>
          <FlowChart metrics={c.metrics} />
        </section>
      )}

      <Section icon={<TrendingUp className="size-4" />} title="감정 변화" question="기간 동안 감정은 어떻게 움직였나" section={c.emotion_trend} />

      <Section icon={<Map className="size-4" />} title="스트레스 지도" question="어떤 시기·상황에서 스트레스를 받나" section={c.stress_map}>
        {c.stress_map.top_stressors.length > 0 && (
          <ol className="mt-4 space-y-2">
            {c.stress_map.top_stressors.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-warning-soft text-micro font-bold text-warning">{i + 1}</span>
                <span className="flex-1 text-body font-medium">{s.name}</span>
                <span className="text-caption text-muted">{s.when}</span>
                <span className="text-caption tabular text-subtle">{s.count}회</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {(c.time_patterns || c.metrics) && (
        <TimePatternsSection patterns={c.time_patterns} metrics={c.metrics} />
      )}

      <Section icon={<LifeBuoy className="size-4" />} title="대처 기록" question="스트레스 뒤 무엇이 회복에 도움이 됐나" section={c.coping} />

      <Section icon={<Eye className="size-4" />} title="긍정/부정 시선" question="나를 어떻게 보고 있나" section={c.self_view}>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <QuoteList tone="positive" title="긍정적으로 본 순간" items={c.self_view.positive_quotes} />
          <QuoteList tone="negative" title="부정적으로 본 순간" items={c.self_view.negative_quotes} />
        </div>
      </Section>

      <Section icon={<Sun className="size-4" />} title="행복과 불행의 조건" question="어떤 상황에서 행복하고 불행한가" section={c.happiness_conditions}>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <QuoteList tone="positive" title="행복했던 순간" items={c.happiness_conditions.happy} footer={c.happiness_conditions.happy_common} />
          <QuoteList tone="negative" title="불행했던 순간" items={c.happiness_conditions.unhappy} footer={c.happiness_conditions.unhappy_common} />
        </div>
      </Section>

      <Section icon={<Repeat className="size-4" />} title="지속력 분석" question="무엇을 이어가고 무엇을 놓았나" section={c.persistence}>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <NamedList title="이어간 것" tone="positive" items={c.persistence.sustained} />
          <NamedList title="놓은 것" tone="negative" items={c.persistence.dropped} />
        </div>
        {c.persistence.counterexamples.length > 0 && (
          <div className="mt-3 rounded-md border border-success/30 bg-success-soft/50 px-4 py-3">
            <p className="text-caption font-semibold text-success">“끈기가 부족하다”는 가설에 대한 반례</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-caption text-foreground/85">
              {c.persistence.counterexamples.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        )}
      </Section>

      <Card className="border-primary/20 bg-primary text-primary-foreground">
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2 text-caption font-semibold opacity-80">
            <Footprints className="size-4" /> 다음 한 걸음
          </div>
          <p className="text-heading font-semibold leading-snug">{c.next_step.experiment}</p>
          <p className="text-caption leading-relaxed opacity-80">{c.next_step.why}</p>
          <p className="text-caption opacity-80"><span className="font-semibold">측정:</span> {c.next_step.how_to_measure}</p>
        </CardBody>
      </Card>

      {(c.next_step.recommended?.length || c.next_step.avoid?.length) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionList tone="do" title="권하는 행동" items={c.next_step.recommended ?? []} />
          <ActionList tone="avoid" title="피해야 할 행동" items={c.next_step.avoid ?? []} />
        </div>
      ) : null}

      {c.change_points.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-subtle">
            <Flag className="size-3.5" /> 변화 구간
          </h2>
          <ol className="relative space-y-3 border-l border-border pl-5">
            {c.change_points.map((cp, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-accent ring-4 ring-background" />
                <DayDate date={cp.date} className="text-caption font-semibold text-accent" />
                <p className="text-body text-foreground/90">{cp.description}</p>
              </li>
            ))}
          </ol>
          <p className="text-caption text-subtle">타임라인에도 표시됩니다.</p>
        </section>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="이 리포트를 삭제할까요?"
        description="근거 연결도 함께 삭제됩니다. 기록 자체는 유지됩니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>취소</Button>
            <Button variant="danger" onClick={remove} loading={busy}>삭제</Button>
          </>
        }
      />
    </article>
  );
}

function Section({
  icon,
  title,
  question,
  section,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  question: string;
  section: ReportSection;
  children?: React.ReactNode;
}) {
  return (
    <section className="surface-card px-5 py-5 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-muted">{icon}</span>
        <h2 className="text-heading font-semibold">{title}</h2>
        <span className="hidden text-caption text-subtle sm:inline">· {question}</span>
      </div>
      <p className="mt-3 text-body leading-relaxed">{section.summary}</p>
      {section.bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-body text-foreground/85">
              <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-border-strong" />
              {b}
            </li>
          ))}
        </ul>
      )}
      {children}
      <EvidenceList items={section.evidence} />
    </section>
  );
}

function EvidenceList({ items }: { items: Evidence[] }) {
  if (!items.length) {
    return <p className="mt-4 text-micro text-subtle">근거 기록 없음 — 기록에서 확인되지 않은 내용입니다.</p>;
  }
  return (
    <details className="group mt-4 border-t border-border pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-micro font-semibold uppercase tracking-wider text-subtle transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Quote className="size-3" /> 근거 기록
        <span className="tabular font-normal normal-case">{items.length}건</span>
        <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1.5">
        {items.map((e, i) => (
          <li key={i}>
            <Link
              href={`/entries/${e.entry_id}`}
              className="group/item flex gap-3 rounded-md px-2 py-1.5 text-caption transition-colors hover:bg-surface-2"
            >
              <DayDate date={e.date} className="w-12 shrink-0 text-subtle group-hover/item:text-accent" />
              <span className="text-foreground/80">“{e.quote}”</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * 요일만 보이고, 날짜(11/22)는 마우스를 올리면 말풍선으로 보인다.
 * 마우스가 없는 터치 기기에서는 날짜를 아주 작게 옆에 붙인다.
 */
function DayDate({ date, className }: { date: string; className?: string }) {
  return (
    <span className={`group/date relative inline-flex items-baseline ${className ?? ""}`} aria-label={formatDateKo(date, "M월 d일 EEEE")}>
      <span aria-hidden>{formatDateKo(date, "EEEE")}</span>
      <span aria-hidden className="ml-0.5 hidden text-[10px] leading-none tabular opacity-60 pointer-coarse:inline">
        {formatDateKo(date, "M/d")}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-micro font-medium tabular text-background shadow-md pointer-fine:group-hover/date:block"
      >
        {formatDateKo(date, "M/d")}
      </span>
    </span>
  );
}

function QuoteList({
  tone,
  title,
  items,
  footer,
}: {
  tone: "positive" | "negative";
  title: string;
  items: Evidence[];
  footer?: string;
}) {
  const color = tone === "positive" ? "var(--calm)" : "var(--anger)";
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <p className="flex items-center gap-2 text-caption font-semibold">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-caption text-subtle">기록에서 확인되지 않음</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((e, i) => (
            <li key={i}>
              <Link href={`/entries/${e.entry_id}`} className="block text-caption text-foreground/85 hover:text-foreground">
                <DayDate date={e.date} className="mr-2 text-subtle" />“{e.quote}”
              </Link>
            </li>
          ))}
        </ul>
      )}
      {footer && <p className="mt-3 border-t border-border pt-2 text-caption text-muted">공통점: {footer}</p>}
    </div>
  );
}

function NamedList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "negative";
  items: { name: string; note: string }[];
}) {
  const color = tone === "positive" ? "var(--calm)" : "var(--lethargy)";
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <p className="flex items-center gap-2 text-caption font-semibold">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-caption text-subtle">없음</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((x) => (
            <li key={x.name} className="text-caption">
              <p className="font-medium text-foreground">{x.name}</p>
              <p className="text-muted">{x.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionList({
  tone,
  title,
  items,
}: {
  tone: "do" | "avoid";
  title: string;
  items: { action: string; why: string }[];
}) {
  const Icon = tone === "do" ? Check : X;
  return (
    <section className="surface-card px-5 py-4">
      <h3 className={`flex items-center gap-2 text-caption font-semibold ${tone === "do" ? "text-success" : "text-danger"}`}>
        <span className={`flex size-5 items-center justify-center rounded-full ${tone === "do" ? "bg-success-soft" : "bg-danger-soft"}`}>
          <Icon className="size-3" strokeWidth={3} />
        </span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-caption text-subtle">기록에서 확인되지 않음</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 w-4 shrink-0 text-caption tabular text-subtle">{i + 1}</span>
              <div>
                <p className="text-body font-medium leading-snug">{x.action}</p>
                <p className="mt-0.5 text-caption text-muted">{x.why}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TimePatternsSection({
  patterns,
  metrics,
}: {
  patterns?: NonNullable<ReportRow["content_json"]["time_patterns"]>;
  metrics?: ReportRow["content_json"]["metrics"];
}) {
  const toneStyle = {
    good: "bg-success-soft text-success",
    bad: "bg-danger-soft text-danger",
    neutral: "bg-surface-3 text-muted",
  } as const;
  return (
    <section className="surface-card px-5 py-5 sm:px-6">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-muted">
          <Clock className="size-4" />
        </span>
        <h2 className="text-heading font-semibold">요일·시간대 패턴</h2>
        <span className="hidden text-caption text-subtle sm:inline">· 언제 무엇이 반복되나</span>
      </div>

      {patterns && (
        <>
          <p className="mt-3 text-body leading-relaxed">{patterns.summary}</p>
          {patterns.items.length > 0 && (
            <ul className="mt-4 space-y-2">
              {patterns.items.map((x, i) => (
                <li key={i} className="flex items-start gap-3 rounded-md bg-surface-2 px-3 py-2.5">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${toneStyle[x.tone]}`}>
                    {x.when}
                  </span>
                  <span className="text-body text-foreground/90">{x.pattern}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {metrics && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-caption font-semibold text-muted">요일별 평균</p>
            <WeekdayHeatmap metrics={metrics} />
          </div>
          <div>
            <p className="mb-2 text-caption font-semibold text-muted">기록을 쓴 시간대</p>
            <TimeOfDayBars metrics={metrics} />
            <p className="mt-2 text-micro text-subtle">막대 길이는 기록 수, 진하기는 그때의 평균 스트레스입니다.</p>
          </div>
        </div>
      )}

      {patterns && <EvidenceList items={patterns.evidence} />}
    </section>
  );
}
