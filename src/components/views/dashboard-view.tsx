"use client";

import * as React from "react";
import Link from "next/link";
import { subDays, parseISO, differenceInCalendarDays } from "date-fns";
import { Flame, CalendarDays, Layers, ArrowRight, FileText } from "lucide-react";
import { computeStreak, todayKey, formatDateTimeKo } from "@/lib/utils";
import { EMOTION_META, type Emotion } from "@/lib/constants";
import type { EntryWithTags, HabitCheckRow, HabitRow, ReportRow } from "@/lib/types";
import { useEntries, useHabits, useHabitChecks, useReports, useToday } from "@/lib/query/hooks";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";
import { EmotionFlowChart, type DayPoint } from "@/components/charts/emotion-flow";
import { MeterList } from "@/components/charts/meter-list";

const FLOW_DAYS = 14;

export function DashboardView() {
  const today = useToday();
  const entries = useEntries();
  const habits = useHabits();
  const checks = useHabitChecks(today);
  const reports = useReports();

  const queries = [entries, habits, checks, reports];
  const failed = queries.find((q) => q.isError);
  if (failed) return <QueryError error={failed.error} onRetry={() => queries.forEach((q) => q.isError && q.refetch())} />;
  if (!today || !entries.data || !habits.data || !checks.data || !reports.data) return <PageSkeleton />;

  return (
    <Dashboard
      today={today}
      entries={entries.data}
      habits={habits.data}
      checks30={checks.data}
      reports={reports.data}
    />
  );
}

function Dashboard({
  today,
  entries,
  habits: allHabits,
  checks30,
  reports,
}: {
  today: string;
  entries: EntryWithTags[];
  habits: HabitRow[];
  checks30: HabitCheckRow[];
  reports: ReportRow[];
}) {
  const from30 = todayKey(subDays(parseISO(today), 29));
  const from7 = todayKey(subDays(parseISO(today), 6));

  // 전체 기록 캐시에서 파생 (추가 요청 없음)
  const dates = entries.map((e) => e.entry_date);
  const recent30 = entries.filter((e) => e.entry_date >= from30 && e.entry_date <= today).reverse();
  const habits = allHabits.filter((h) => h.active);

  const analyzable = recent30.filter((e) => !e.risk_flag);
  const streak = computeStreak(dates, today);
  const total = dates.length;
  const weekCount = dates.filter((d) => d >= from7).length;

  // 최근 14일 감정 흐름
  const flow: DayPoint[] = [];
  for (let i = FLOW_DAYS - 1; i >= 0; i--) {
    const key = todayKey(subDays(parseISO(today), i));
    const dayEntries = analyzable.filter((e) => e.entry_date === key);
    let intensity = 0;
    const emotionCount = new Map<string, number>();
    for (const e of dayEntries) {
      const inten = Number(e.entry_tags.find((t) => t.kind === "intensity")?.value ?? 0);
      intensity = Math.max(intensity, inten);
      e.entry_tags.filter((t) => t.kind === "emotion").forEach((t) => emotionCount.set(t.value, (emotionCount.get(t.value) ?? 0) + 1));
    }
    const emotions = [...emotionCount.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    flow.push({
      date: key,
      intensity: dayEntries.length && !intensity ? 1 : intensity,
      emotion: emotions[0] ?? null,
      emotions,
      count: dayEntries.length,
    });
  }

  // 스트레스 상위 요인 (30일)
  const stressorCount = new Map<string, { count: number; last: string }>();
  for (const e of analyzable) {
    for (const t of e.entry_tags.filter((t) => t.kind === "stressor")) {
      const key = t.value.trim();
      const cur = stressorCount.get(key) ?? { count: 0, last: e.entry_date };
      stressorCount.set(key, { count: cur.count + 1, last: e.entry_date > cur.last ? e.entry_date : cur.last });
    }
  }
  const topStressors = [...stressorCount.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  const maxStress = topStressors[0]?.[1].count ?? 1;

  // 지속 활동 체크율 (30일, 시작일 이후만)
  const habitRows = habits.map((h) => {
    const start = h.started_at > from30 ? h.started_at : from30;
    const days = Math.max(1, differenceInCalendarDays(parseISO(today), parseISO(start)) + 1);
    const done = checks30.filter((c) => c.habit_id === h.id && c.done && c.entry_date >= start).length;
    return { name: h.name, value: done / days, figure: `${done}/${days}일`, hint: `${Math.round((done / days) * 100)}%` };
  });

  // 최근 30일 감정 분포
  const emotionTotals = new Map<string, number>();
  analyzable.forEach((e) => e.entry_tags.filter((t) => t.kind === "emotion").forEach((t) => emotionTotals.set(t.value, (emotionTotals.get(t.value) ?? 0) + 1)));
  const emotionSum = [...emotionTotals.values()].reduce((a, b) => a + b, 0);
  const emotionRows = [...emotionTotals.entries()].sort((a, b) => b[1] - a[1]);

  const latest = reports[0] ?? null;
  const empty = total === 0;

  return (
    <div className="space-y-8">
      <PageHeader title="지금의 나" description="최근 기록이 말해주는 현재 상태입니다. 변화는 타임라인에서 봅니다." />

      {empty ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title="아직 데이터가 없습니다"
          description="오늘 한 줄만 적어도 대시보드가 채워지기 시작합니다."
          action={<ButtonLink href="/" variant="primary">첫 기록 쓰기</ButtonLink>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="연속 기록일" value={streak} unit="일" icon={<Flame className="size-4" />} hint={streak > 0 ? "오늘도 이어가고 있습니다" : "오늘 기록하면 다시 시작"} />
            <StatTile label="이번 주 기록" value={weekCount} unit="건" icon={<CalendarDays className="size-4" />} hint="최근 7일" />
            <StatTile label="전체 기록" value={total} unit="건" icon={<Layers className="size-4" />} hint="첫 번째 지속력 실험" />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="최근 감정 흐름" description={`최근 ${FLOW_DAYS}일 · 막대 높이는 감정 강도, 색은 그날의 주 감정`} />
              <CardBody className="pt-4">
                <EmotionFlowChart data={flow} />
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="감정 분포" description="최근 30일 감정 태그" />
              <CardBody className="pt-4">
                {emotionRows.length === 0 ? (
                  <p className="text-caption text-muted">아직 감정 태그가 없습니다.</p>
                ) : (
                  <>
                    <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md">
                      {emotionRows.map(([m, n]) => (
                        <div
                          key={m}
                          className="h-full"
                          style={{ width: `${(n / emotionSum) * 100}%`, background: EMOTION_META[m as Emotion]?.color }}
                          title={`${m} ${n}`}
                        />
                      ))}
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {emotionRows.map(([m, n]) => (
                        <li key={m} className="flex items-center justify-between text-caption">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ background: EMOTION_META[m as Emotion]?.color }} />
                            {m}
                          </span>
                          <span className="tabular text-muted">{n}회 · {Math.round((n / emotionSum) * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="스트레스 상위 요인" description="최근 30일 · AI가 추출한 원인" />
              <CardBody className="pt-4">
                {topStressors.length === 0 ? (
                  <p className="text-caption text-muted">기록된 스트레스 원인이 없습니다.</p>
                ) : (
                  <MeterList
                    rows={topStressors.map(([name, v]) => ({
                      name,
                      value: v.count / maxStress,
                      figure: `${v.count}회`,
                      hint: `마지막 ${v.last.slice(5).replace("-", "/")}`,
                      tone: "warning" as const,
                    }))}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="지속 활동 체크율"
                description="최근 30일"
                action={<Link href="/settings#habits" className="text-caption text-muted hover:text-foreground">관리</Link>}
              />
              <CardBody className="pt-4">
                {habitRows.length === 0 ? (
                  <p className="text-caption text-muted">지속하고 싶은 활동을 설정에서 등록하세요.</p>
                ) : (
                  <MeterList rows={habitRows} />
                )}
              </CardBody>
            </Card>
          </div>

          <section className="space-y-3">
            <SectionTitle action={<Link href="/reports" className="inline-flex items-center gap-1 text-caption text-muted hover:text-foreground">리포트 <ArrowRight className="size-3.5" /></Link>}>
              최신 리포트
            </SectionTitle>
            {latest ? (
              <Link href={`/reports/${latest.id}`} className="surface-card block px-5 py-5 transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-md">
                <div className="flex flex-wrap items-center gap-2 text-caption text-subtle">
                  <Badge tone="accent">{latest.period_key === "all" ? "전체" : latest.period_key === "7d" ? "최근 7일" : "최근 30일"}</Badge>
                  <span>{formatDateTimeKo(latest.created_at)} · 기록 {latest.entry_count}건</span>
                </div>
                <p className="mt-2 text-heading font-semibold">{latest.content_json.headline}</p>
                <p className="mt-2 line-clamp-2 text-body text-muted">{latest.content_json.emotion_trend.summary}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-caption font-medium text-accent">
                  <FileText className="size-3.5" /> 다음 한 걸음: {latest.content_json.next_step.experiment}
                </p>
              </Link>
            ) : (
              <EmptyState title="아직 리포트가 없습니다" description="기록 7건부터 리포트를 생성할 수 있습니다." action={<ButtonLink href="/reports">리포트로 이동</ButtonLink>} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
