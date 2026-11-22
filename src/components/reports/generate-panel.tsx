"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PERIODS, type PeriodKey } from "@/lib/constants";
import { useGenerateReport, readPendingReportJob, type GenerateReportResponse } from "@/lib/query/hooks";
import { todayKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";

const notified = new Set<string>();

export function GeneratePanel({
  counts,
  min,
  aiAvailable,
}: {
  counts: Record<string, number>;
  min: number;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [period, setPeriod] = React.useState<PeriodKey>("30d");
  const generateReport = useGenerateReport();
  const busy = generateReport.isPending;
  const [notice, setNotice] = React.useState<string | null>(null);

  const count = counts[period] ?? 0;
  const enough = count >= min;

  // 화면이 사라진 뒤 끝난 생성은 이동 없이 알림만, 같은 리포트 알림은 한 번만
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handle = React.useCallback(
    async (run: () => Promise<GenerateReportResponse>) => {
      try {
        const res = await run();
        if (res.insufficient) {
          if (mounted.current) setNotice(res.message);
          return;
        }
        if (!notified.has(res.report.id)) {
          notified.add(res.report.id);
          toast.push({ tone: "success", title: "리포트가 생성되었습니다" });
        }
        if (mounted.current) router.push(`/reports/${res.report.id}`);
      } catch (e) {
        toast.push({ tone: "error", title: "리포트 생성 실패", description: e instanceof Error ? e.message : undefined });
      }
    },
    [router, toast],
  );

  // 생성 도중 화면을 떠났다 돌아오면 남아 있는 작업을 이어서 기다린다
  const { mutateAsync } = generateReport;
  React.useEffect(() => {
    const job = readPendingReportJob();
    if (!job) return;
    const t = setTimeout(() => void handle(() => mutateAsync({ resume: job })), 0);
    return () => clearTimeout(t);
  }, [handle, mutateAsync]);

  function generate() {
    setNotice(null);
    void handle(() => generateReport.mutateAsync({ period_key: period, today: todayKey() }));
  }

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-heading font-semibold">새 리포트 생성</p>
            <p className="mt-0.5 text-caption text-muted">
              선택한 기간의 기록 전체를 근거로 7개 섹션을 만듭니다.
            </p>
          </div>
          <Segmented<PeriodKey>
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-title font-semibold tabular">{count}</span>
              <span className="text-caption text-muted">건의 기록</span>
              <span className="ml-auto text-micro text-subtle">최소 {min}건</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.min(100, (count / min) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {busy && (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-caption text-muted">
            리포트를 만드는 중입니다. 기록이 많으면 몇 분 걸릴 수 있어요. 다른 화면으로 가도 계속 만들어집니다.
          </p>
        )}
        {notice && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-caption text-warning">{notice}</p>
        )}
        {!aiAvailable && (
          <p className="text-caption text-warning">OPENAI_API_KEY 가 설정되지 않아 리포트를 만들 수 없습니다.</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-subtle">
            {enough
              ? "같은 기간을 다시 생성하면 이전 리포트와 달라진 점을 함께 알려줍니다."
              : `아직 말할 수 없습니다. ${min - count}건 더 쓰면 생성할 수 있습니다.`}
          </p>
          <Button onClick={generate} loading={busy} disabled={!enough || !aiAvailable} size="lg">
            <Sparkles className="size-4" /> 생성
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
