import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarDays, CalendarRange, PenLine, type LucideIcon } from "lucide-react";
import type { ReportRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface Step {
  icon: LucideIcon;
  when: string;
  title: string;
  description: string;
  /** 이 주기에 해당하는 리포트 기간. 없으면 기록 단계 */
  periodKey?: "7d" | "30d";
  /** 이 일수가 지나면 "만들 때가 됐다"고 표시 */
  dueAfterDays?: number;
}

const STEPS: Step[] = [
  {
    icon: PenLine,
    when: "매일",
    title: "기록만 씁니다",
    description: "분석은 신경 쓰지 않고 오늘 있었던 일과 감정을 남깁니다.",
  },
  {
    icon: CalendarDays,
    when: "주 1회",
    title: "최근 7일 리포트",
    description: "한 주의 감정과 스트레스 원인을 보고, 다음 주에 해볼 작은 실험 하나를 고릅니다.",
    periodKey: "7d",
    dueAfterDays: 7,
  },
  {
    icon: CalendarRange,
    when: "월 1회",
    title: "최근 30일 리포트",
    description: "큰 흐름과 변화 구간을 보고, 지난달 리포트와 무엇이 달라졌는지 확인합니다.",
    periodKey: "30d",
    dueAfterDays: 30,
  },
];

/** 리포트 화면 상단의 권장 사용 리듬 안내. 주기별 마지막 생성 시점을 함께 보여 준다. */
export function RhythmGuide({ reports, today }: { reports: ReportRow[]; today: string }) {
  return (
    <Card>
      <CardHeader
        title="이렇게 쓰면 좋아요"
        description="리포트는 자주 만들수록 좋은 게 아니라, 비교할 만큼 기록이 쌓였을 때 의미가 생깁니다."
      />
      <CardBody className="pt-4">
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.when} className="flex flex-col rounded-lg bg-surface-2 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-surface text-accent">
                  <s.icon className="size-4" />
                </span>
                <span className="text-caption font-semibold text-accent">{s.when}</span>
              </div>
              <p className="mt-2.5 text-body font-semibold">{s.title}</p>
              <p className="mt-1 flex-1 text-caption leading-relaxed text-muted">{s.description}</p>
              {s.periodKey && (
                <LastMade reports={reports} today={today} periodKey={s.periodKey} dueAfterDays={s.dueAfterDays!} />
              )}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function LastMade({
  reports,
  today,
  periodKey,
  dueAfterDays,
}: {
  reports: ReportRow[];
  today: string;
  periodKey: "7d" | "30d";
  dueAfterDays: number;
}) {
  // 목록은 최신순
  const last = reports.find((r) => r.period_key === periodKey);
  if (!last) {
    return <p className="mt-3 border-t border-border pt-2.5 text-micro text-subtle">아직 만든 적 없음</p>;
  }
  const days = differenceInCalendarDays(parseISO(today), parseISO(last.created_at.slice(0, 10)));
  const due = days >= dueAfterDays;
  return (
    <p
      className={cn(
        "mt-3 border-t border-border pt-2.5 text-micro",
        due ? "font-semibold text-accent" : "text-subtle",
      )}
    >
      마지막 생성 {days === 0 ? "오늘" : `${days}일 전`}
      {due ? " · 새로 만들 때예요" : ""}
    </p>
  );
}
