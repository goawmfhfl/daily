import type { Metadata } from "next";
import Link from "next/link";
import { subDays } from "date-fns";
import { FileText, ChevronRight } from "lucide-react";
import { requireUserPage } from "@/lib/supabase/server";
import { fetchReports } from "@/lib/data";
import { todayKeySeoul, formatDateTimeKo } from "@/lib/utils";
import { PERIODS, MIN_ENTRIES_FOR_REPORT } from "@/lib/constants";
import { hasOpenAI } from "@/lib/openai";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { GeneratePanel } from "@/components/reports/generate-panel";

export const metadata: Metadata = { title: "리포트" };

export default async function ReportsPage() {
  const { supabase } = await requireUserPage();
  const today = todayKeySeoul();

  // 기간별 기록 수 (분석 제외 기록 제외)
  const counts: Record<string, number> = {};
  for (const p of PERIODS) {
    let q = supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("risk_flag", false);
    if (p.days) q = q.gte("entry_date", todayKeySeoul(subDays(new Date(today), p.days - 1)));
    const { count } = await q;
    counts[p.key] = count ?? 0;
  }

  const reports = await fetchReports(supabase, { limit: 50 });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="리포트"
        description="분석은 내가 누를 때 만들어집니다. 모든 주장에는 근거 기록이 붙습니다."
      />

      <GeneratePanel
        counts={counts}
        min={MIN_ENTRIES_FOR_REPORT}
        aiAvailable={hasOpenAI()}
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
