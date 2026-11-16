import type { Metadata } from "next";
import { Suspense } from "react";
import { EntriesView } from "@/components/views/entries-view";
import { PageSkeleton } from "@/components/ui/query-state";

export const metadata: Metadata = { title: "기록 목록" };

export default function EntriesPage() {
  // 필터는 URL 검색어(useSearchParams)로 클라이언트에서 처리 → 정적 페이지 유지
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EntriesView />
    </Suspense>
  );
}
