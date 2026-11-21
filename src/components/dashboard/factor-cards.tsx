"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTimeKo } from "@/lib/utils";
import type { EntryWithTags, FactorInsightResponse, FactorItem } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MeterList, type MeterRow } from "@/components/charts/meter-list";

/* 이 카드에서만 쓰는 조회. 대시보드를 열 때마다 "그 사이 새 기록이 있었는지"를 서버에 다시 묻는다 */
const key = (today: string) => ["factor-insight", today] as const;

function useFactorInsight(today: string) {
  return useQuery({
    queryKey: key(today),
    queryFn: () => api<FactorInsightResponse>(`/api/factor-insights?today=${today}`),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}

function useGenerateFactorInsight(today: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<FactorInsightResponse>("/api/factor-insights", { method: "POST", body: { today } }),
    onSuccess: (res) => qc.setQueryData(key(today), res),
  });
}

const md = (d: string) => d.slice(5).replace("-", "/");

/** AI 분석이 없을 때: 태그 그대로 세되, 동률이면 최근 것이 위로 */
function tagStressors(entries: EntryWithTags[]): FactorItem[] {
  const map = new Map<string, FactorItem>();
  for (const e of entries) {
    for (const t of e.entry_tags) {
      if (t.kind !== "stressor" || !t.value.trim()) continue;
      const k = t.value.trim();
      const cur = map.get(k) ?? { factor: k, detail: "", count: 0, last: e.entry_date, evidence: [] };
      map.set(k, { ...cur, count: cur.count + 1, last: e.entry_date > cur.last ? e.entry_date : cur.last });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, 5);
}

function rows(items: FactorItem[], tone: MeterRow["tone"]): MeterRow[] {
  const max = Math.max(1, ...items.map((i) => i.count));
  return items.map((i) => ({
    name: i.factor,
    value: i.count / max,
    figure: `${i.count}회`,
    hint: [`마지막 ${md(i.last)}`, i.detail].filter(Boolean).join(" · "),
    tone,
  }));
}

/**
 * 최근 30일 스트레스 상위 요인 + 평온 상위 요인.
 * 비슷한 표현을 AI 가 하나로 묶어 세고, 새 기록이 생기면 대시보드를 열 때 자동으로 다시 분석한다.
 * entries: 최근 30일·위기 표시 제외 기록 (분석 전·AI 없음일 때 태그 집계로 대신 보여준다)
 */
export function FactorCards({ today, entries }: { today: string; entries: EntryWithTags[] }) {
  const query = useFactorInsight(today);
  const generate = useGenerateFactorInsight(today);
  const data = query.data;

  // 분석이 없거나 낡았으면 한 번만 자동 갱신 (같은 상태로 실패를 반복하지 않게 지문으로 막는다)
  const tried = React.useRef<string | null>(null);
  const needs = data?.status === "none" || (data?.status === "ok" && data.stale);
  const attempt = data ? `${data.status}|${data.status === "ok" ? data.insight.source_sig : ""}` : null;
  const { mutate, isPending } = generate;
  React.useEffect(() => {
    if (!needs || !attempt || isPending || query.isFetching || tried.current === attempt) return;
    tried.current = attempt;
    mutate();
  }, [needs, attempt, isPending, query.isFetching, mutate]);

  const insight = data?.status === "ok" ? data.insight : null;
  const failed = generate.isError && !isPending;
  const updating = isPending || (needs && !failed);

  const status = updating ? (
    <span className="inline-flex items-center gap-1 text-micro text-subtle">
      <Loader2 className="size-3 animate-spin" /> 새 기록 반영 중
    </span>
  ) : failed ? (
    <button
      type="button"
      onClick={() => mutate()}
      className="inline-flex items-center gap-1 text-micro text-muted hover:text-foreground"
      title={generate.error instanceof Error ? generate.error.message : undefined}
    >
      <RotateCcw className="size-3" /> 다시 분석
    </button>
  ) : null;

  const description = insight
    ? `최근 30일 · 기록 ${insight.entry_count}건 · ${formatDateTimeKo(insight.created_at)} 분석`
    : "최근 30일";

  const stress = insight ? insight.content_json.stress : tagStressors(entries);
  const calm = insight?.content_json.calm ?? [];

  const placeholder = (text: string) => <p className="text-caption text-muted">{text}</p>;
  const pendingText = updating ? "기록을 읽고 요인을 정리하고 있어요." : null;

  return (
    <>
      <Card>
        <CardHeader title="스트레스 상위 요인" description={description} action={status} />
        <CardBody className="pt-4">
          {stress.length > 0
            ? <MeterList rows={rows(stress, "warning")} />
            : placeholder(pendingText ?? "기록된 스트레스 원인이 없습니다.")}
          {!insight && stress.length > 0 && (
            <p className="mt-3 text-micro text-subtle">태그 그대로 센 값이에요. AI 분석이 끝나면 비슷한 원인끼리 묶어 보여드려요.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="평온을 주는 상위 요인" description={description} action={status} />
        <CardBody className="pt-4">
          {calm.length > 0
            ? <MeterList rows={rows(calm, "calm")} />
            : placeholder(
                pendingText ??
                  (data?.status === "no_ai"
                    ? "AI 분석을 켜면 마음을 편하게 해준 것들을 찾아드려요."
                    : insight
                      ? "최근 30일 기록에서 평온했던 순간을 아직 찾지 못했어요."
                      : "아직 분석 전이에요."),
              )}
        </CardBody>
      </Card>
    </>
  );
}
