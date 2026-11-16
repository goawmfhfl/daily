"use client";

import { useEntry } from "@/lib/query/hooks";
import { ApiError } from "@/lib/api";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { EntryEditor } from "@/components/entries/entry-editor";

export function EntryDetailView({ id }: { id: string }) {
  const entry = useEntry(id);

  if (entry.isError) {
    if (entry.error instanceof ApiError && entry.error.status === 404) {
      return (
        <EmptyState
          title="기록을 찾을 수 없습니다"
          description="삭제되었거나 주소가 잘못되었습니다."
          action={<ButtonLink href="/entries">기록 목록</ButtonLink>}
        />
      );
    }
    return <QueryError error={entry.error} onRetry={() => void entry.refetch()} />;
  }
  if (!entry.data) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl">
      {/* 다른 기록으로 이동하면 편집 상태를 새로 시작 */}
      <EntryEditor key={entry.data.id} entry={entry.data} />
    </div>
  );
}
