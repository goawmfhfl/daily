"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Flag, Zap } from "lucide-react";
import { formatDateKo, truncate } from "@/lib/utils";
import { EMOTION_META, type Emotion } from "@/lib/constants";
import type { EntryWithTags, ReportRow } from "@/lib/types";
import { useEntries, useReports } from "@/lib/query/hooks";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";
import { TimelineCharts, type TimelineEntry, type ChangePoint } from "@/components/charts/timeline-chart";

export function TimelineView() {
  const entries = useEntries();
  const reports = useReports();

  const failed = [entries, reports].find((q) => q.isError);
  if (failed) return <QueryError error={failed.error} onRetry={() => { void entries.refetch(); void reports.refetch(); }} />;
  if (!entries.data || !reports.data) return <PageSkeleton />;

  return <Timeline entries={entries.data} reports={reports.data.slice(0, 20)} />;
}

function Timeline({ entries: latestFirst, reports }: { entries: EntryWithTags[]; reports: ReportRow[] }) {
  // 캐시는 최신순이므로 차트용으로 오래된 순으로 뒤집는다
  const entries = React.useMemo(() => [...latestFirst].reverse(), [latestFirst]);
  const analyzable = entries.filter((e) => !e.risk_flag);

  const data: TimelineEntry[] = analyzable.map((e) => {
    const tags = e.entry_tags;
    const intensity = tags.find((t) => t.kind === "intensity")?.value;
    return {
      id: e.id,
      date: e.entry_date,
      emotions: tags.filter((t) => t.kind === "emotion").map((t) => t.value),
      intensity: intensity ? Number(intensity) : null,
      events: tags.filter((t) => t.kind === "event").map((t) => t.value),
      stressor: tags.find((t) => t.kind === "stressor")?.value ?? null,
      snippet: truncate(e.content, 100),
    };
  });

  // 리포트들이 찾은 변화 구간 (중복 날짜는 최신 리포트 우선)
  const cpMap = new Map<string, ChangePoint & { reportId: string }>();
  for (const r of reports) {
    for (const cp of r.content_json.change_points) {
      if (!cpMap.has(cp.date)) cpMap.set(cp.date, { ...cp, reportId: r.id });
    }
  }
  const changePoints = [...cpMap.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  // 주요 사건: 강도 4 이상
  const major = data.filter((d) => (d.intensity ?? 0) >= 4).slice(-12).reverse();

  return (
    <div className="space-y-8">
      <PageHeader title="시간에 따른 나" description="월·주 단위 감정 곡선, 주요 사건, AI가 찾은 변화 구간." />

      {data.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-5" />}
          title="아직 그릴 수 있는 시간이 없습니다"
          description="기록이 쌓이면 주·월 단위 변화가 보입니다."
          action={<ButtonLink href="/" variant="primary">기록 쓰기</ButtonLink>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardBody>
              <TimelineCharts entries={data} changePoints={changePoints} />
            </CardBody>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="변화 구간" description="리포트가 찾은 전환점" />
              <CardBody className="pt-3">
                {changePoints.length === 0 ? (
                  <p className="text-caption text-muted">
                    리포트를 생성하면 변화 구간이 여기에 표시됩니다.{" "}
                    <Link href="/reports" className="text-accent underline-offset-2 hover:underline">리포트로</Link>
                  </p>
                ) : (
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {changePoints.map((cp) => (
                      <li key={cp.date} className="relative">
                        <span className="absolute -left-[26px] top-1.5 flex size-3 items-center justify-center rounded-full bg-accent ring-4 ring-surface">
                          <Flag className="size-2 text-accent-foreground" />
                        </span>
                        <Link href={`/reports/${cp.reportId}`} className="block">
                          <p className="text-caption font-semibold text-accent">{formatDateKo(cp.date, "yyyy년 M월 d일")}</p>
                          <p className="text-body text-foreground/90">{cp.description}</p>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="주요 사건" description="감정 강도 4 이상이었던 날" />
              <CardBody className="pt-3">
                {major.length === 0 ? (
                  <p className="text-caption text-muted">강도 높은 기록이 아직 없습니다.</p>
                ) : (
                  <ul className="space-y-1">
                    {major.map((d) => {
                      const dominant = d.emotions[0] as Emotion | undefined;
                      return (
                        <li key={d.id}>
                          <Link href={`/entries/${d.id}`} className="flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2">
                            <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: dominant ? EMOTION_META[dominant].color : "var(--border-strong)" }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-caption">
                                <span className="font-medium">{formatDateKo(d.date, "M월 d일")}</span>
                                <span className="inline-flex items-center gap-0.5 text-subtle"><Zap className="size-3" />{d.intensity}</span>
                                {d.events.map((ev) => <Badge key={ev}>{ev}</Badge>)}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-caption text-muted">{d.snippet}</p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
