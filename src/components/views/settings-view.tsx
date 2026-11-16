"use client";

import { useMe, useSettings } from "@/lib/query/hooks";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { HabitsManager } from "@/components/settings/habits-manager";
import { DangerZone } from "@/components/settings/danger-zone";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-state";

export function SettingsView() {
  const me = useMe();
  const settings = useSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="설정" description={me.data?.email ?? undefined} />

      <Card>
        <CardHeader title="화면" description="라이트 · 다크 · 시스템" />
        <CardBody className="pt-4">
          <ThemeToggle />
        </CardBody>
      </Card>

      {settings.isError ? (
        <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
      ) : settings.data ? (
        <SettingsForm initial={settings.data} />
      ) : (
        <Skeleton className="h-80" />
      )}

      <div id="habits">
        <HabitsManager />
      </div>

      <Card>
        <CardHeader title="AI와 데이터" description="분석 요청은 OpenAI API로 보내집니다" />
        <CardBody className="space-y-3 pt-4 text-caption leading-relaxed text-muted">
          <p>
            기록을 저장하면 태그 제안과 한 줄 응답을 위해 그 기록 한 건이, 리포트를 생성하면 선택한 기간의 기록 전체가 OpenAI API로 전송됩니다.
            OpenAI API 로 보낸 데이터는 기본적으로 모델 학습에 사용되지 않습니다(OpenAI API 데이터 정책 기준, 출시 전 최신 정책 재확인 필요).
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-surface-2 px-4 py-3 font-mono text-micro">
            <dt className="text-subtle">상태</dt>
            <dd>{!me.data ? "…" : me.data.aiAvailable ? "연결됨" : "OPENAI_API_KEY 없음"}</dd>
            <dt className="text-subtle">태깅·대화</dt>
            <dd>{me.data?.models.fast ?? "…"}</dd>
            <dt className="text-subtle">리포트</dt>
            <dd>{me.data?.models.report ?? "…"}</dd>
            <dt className="text-subtle">임베딩</dt>
            <dd>{me.data?.models.embedding ?? "…"}</dd>
          </dl>
          <p>
            위기 표현이 감지된 기록은 AI 분석과 태깅에서 제외되고, 리포트의 근거로도 쓰이지 않습니다.
          </p>
        </CardBody>
      </Card>

      <DangerZone />

      <form action="/api/auth/signout" method="post" className="pt-2">
        <button className="text-caption text-muted underline-offset-2 hover:text-foreground hover:underline">
          로그아웃
        </button>
      </form>
    </div>
  );
}
