import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/supabase/server";
import { fetchReport, fetchReports } from "@/lib/data";
import { ReportView } from "@/components/reports/report-view";

export const metadata: Metadata = { title: "리포트" };

export default async function ReportDetailPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUserPage();
  const report = await fetchReport(supabase, id);
  if (!report) notFound();

  // 같은 기간의 직전 리포트 (비교용)
  const siblings = await fetchReports(supabase, { periodKey: report.period_key, limit: 50 });
  const idx = siblings.findIndex((r) => r.id === report.id);
  const previous = idx >= 0 ? (siblings[idx + 1] ?? null) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <ReportView report={report} previous={previous} />
    </div>
  );
}
