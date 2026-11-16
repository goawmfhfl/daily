"use client";

import * as React from "react";
import { useReport, useReports } from "@/lib/query/hooks";
import { ApiError } from "@/lib/api";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ReportView } from "@/components/reports/report-view";

export function ReportDetailView({ id }: { id: string }) {
  const report = useReport(id);
  const list = useReports();

  // 같은 기간의 직전 리포트 (비교용) — 목록 캐시에서 찾는다
  const previous = React.useMemo(() => {
    if (!report.data || !list.data) return null;
    const siblings = list.data.filter((r) => r.period_key === report.data.period_key);
    const idx = siblings.findIndex((r) => r.id === report.data.id);
    return idx >= 0 ? (siblings[idx + 1] ?? null) : null;
  }, [report.data, list.data]);

  if (report.isError) {
    if (report.error instanceof ApiError && report.error.status === 404) {
      return (
        <EmptyState
          title="리포트를 찾을 수 없습니다"
          description="삭제되었거나 주소가 잘못되었습니다."
          action={<ButtonLink href="/reports">리포트 목록</ButtonLink>}
        />
      );
    }
    return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  }
  if (!report.data) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl">
      <ReportView report={report.data} previous={previous} />
    </div>
  );
}
