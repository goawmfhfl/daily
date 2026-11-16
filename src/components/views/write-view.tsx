"use client";

import { useMe, useSettings, useToday } from "@/lib/query/hooks";
import { WriteScreen } from "@/components/write/write-screen";
import { RecentEntries } from "@/components/write/recent-entries";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";

export function WriteView() {
  const today = useToday();
  const settings = useSettings();
  const me = useMe();

  const failed = [settings, me].find((q) => q.isError);
  if (failed) return <QueryError error={failed.error} onRetry={() => { void settings.refetch(); void me.refetch(); }} />;
  // 기본 기록 방식·AI 모드는 설정에, 초안 보관은 사용자 id 에 달려 있으므로 둘 다 오면 그린다
  // (두 번째 방문부터는 캐시로 즉시)
  if (!today || !settings.data || !me.data) return <PageSkeleton />;

  return (
    <WriteScreen
      userId={me.data.id}
      today={today}
      settings={settings.data}
      aiAvailable={me.data.aiAvailable}
      recent={<RecentEntries today={today} />}
    />
  );
}
