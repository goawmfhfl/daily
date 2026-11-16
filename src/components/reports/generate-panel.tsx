"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PERIODS, type PeriodKey } from "@/lib/constants";
import { useGenerateReport } from "@/lib/query/hooks";
import { todayKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";

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

  async function generate() {
    setNotice(null);
    try {
      // 새 리포트는 리포트 캐시에 바로 들어가므로 상세 화면이 추가 요청 없이 열린다
      const res = await generateReport.mutateAsync({ period_key: period, today: todayKey() });
      if (res.insufficient) {
        setNotice(res.message);
        return;
      }
      toast.push({ tone: "success", title: "리포트가 생성되었습니다" });
      router.push(`/reports/${res.report.id}`);
    } catch (e) {
      toast.push({ tone: "error", title: "리포트 생성 실패", description: e instanceof Error ? e.message : undefined });
    }
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
