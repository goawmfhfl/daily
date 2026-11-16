"use client";

import * as React from "react";
import Link from "next/link";
import { parseISO, subDays } from "date-fns";
import { FileText, ChevronRight } from "lucide-react";
import { todayKey, formatDateTimeKo } from "@/lib/utils";
import { PERIODS, MIN_ENTRIES_FOR_REPORT } from "@/lib/constants";
import { useEntries, useMe, useReports, useToday } from "@/lib/query/hooks";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";
import { GeneratePanel } from "@/components/reports/generate-panel";

export function ReportsView() {
  const today = useToday();
  const entries = useEntries();
  const reportsQuery = useReports();
  const me = useMe();

  // 기간별 기록 수 (분석 제외 기록 제외) — 기록 캐시에서 계산하므로 개수 조회 요청이 따로 없다
  const counts = React.useMemo(() => {
    const out: Record<string, number> = {};
    if (!today || !entries.data) return out;
    const analyzable = entries.data.filter((e) => !e.risk_flag);
    for (const p of PERIODS) {
      const from = p.days ? todayKey(subDays(parseISO(today), p.days - 1)) : null;
      out[p.key] = from ? analyzable.filter((e) => e.entry_date >= from).length : analyzable.length;
    }
    return out;
  }, [today, entries.data]);

  const failed = [entries, reportsQuery].find((q) => q.isError);
  if (failed) return <QueryError error={failed.error} onRetry={() => { void entries.refetch(); void reportsQuery.refetch(); }} />;
  if (!today || !entries.data || !reportsQuery.data) return <PageSkeleton />;
  const reports = reportsQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="리포트"
        description="분석은 내가 누를 때 만들어집니다. 모든 주장에는 근거 기록이 붙습니다."
      />

      <GeneratePanel
        counts={counts}
        min={MIN_ENTRIES_FOR_REPORT}
        aiAvailable={me.data?.aiAvailable ?? true}
      />

      <section className="space-y-3">
        <SectionTitle>이전 리포트</SectionTitle>
        {reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="아직 생성된 리포트가 없습니다"
            description={`기록이 ${MIN_ENTRIES_FOR_REPORT}건 이상 쌓이면 위에서 생성할 수 있습니다.`}
          />
        ) : (
          <ul className="surface-card divide-y divide-border">
            {reports.map((r) => {
              const period = PERIODS.find((p) => p.key === r.period_key);
              return (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{period?.label ?? r.period_key}</Badge>
                        <span className="text-caption text-subtle">
                          {r.period_start} ~ {r.period_end} · 기록 {r.entry_count}건
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-body font-medium">
                        {r.content_json.headline}
                      </p>
                      <p className="mt-1 text-micro text-subtle">
                        {formatDateTimeKo(r.created_at)} · {r.model}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
