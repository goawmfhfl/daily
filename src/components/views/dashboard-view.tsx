"use client";

import * as React from "react";
import Link from "next/link";
import { subDays, parseISO } from "date-fns";
import { Flame, CalendarDays, Layers, ArrowRight, FileText } from "lucide-react";
import { computeStreak, todayKey, formatDateTimeKo, habitDaysBetween, weekdaysLabel } from "@/lib/utils";
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
import { EmotionInsightCard } from "@/components/dashboard/emotion-insight-card";
import { FactorCards } from "@/components/dashboard/factor-cards";

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

  // 지속 활동 체크율 (30일, 시작일 이후 + 그 활동의 요일만)
  const habitRows = habits.map((h) => {
    const start = h.started_at > from30 ? h.started_at : from30;
    const due = new Set(habitDaysBetween(h, start, today));
    const days = Math.max(1, due.size);
    const done = checks30.filter((c) => c.habit_id === h.id && c.done && due.has(c.entry_date)).length;
    return {
      name: h.name,
      value: done / days,
      figure: `${done}/${days}일`,
      hint: `${weekdaysLabel(h.weekdays)} · ${Math.round((done / days) * 100)}%`,
    };
  });

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

          <Card>
            <CardHeader title="최근 감정 흐름" description={`최근 ${FLOW_DAYS}일 · 막대 높이는 감정 강도, 색은 그날의 주 감정`} />
            <CardBody className="pt-4">
              <EmotionFlowChart data={flow} />
            </CardBody>
          </Card>

          <EmotionInsightCard entries={entries} today={today} />

          {/* 스트레스·평온 상위 요인 (최근 30일, 새 기록이 생기면 자동 재분석) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <FactorCards today={today} entries={analyzable} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
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
