"use client";

import { useMe, useSettings, useToday } from "@/lib/query/hooks";
import { WriteScreen } from "@/components/write/write-screen";
import { RecentEntries } from "@/components/write/recent-entries";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";

export function WriteView() {
  const today = useToday();
  const settings = useSettings();
  const me = useMe();

  if (settings.isError) return <QueryError error={settings.error} onRetry={() => void settings.refetch()} />;
  // 기본 기록 방식·AI 모드가 설정에 달려 있으므로 설정이 오면 그린다 (두 번째 방문부터는 캐시로 즉시)
  if (!today || !settings.data) return <PageSkeleton />;

  return (
    <WriteScreen
      today={today}
      settings={settings.data}
      aiAvailable={me.data?.aiAvailable ?? true}
      recent={<RecentEntries today={today} />}
    />
  );
}
