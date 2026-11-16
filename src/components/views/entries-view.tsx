"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { parseISO, subDays } from "date-fns";
import { Search } from "lucide-react";
import { todayKey } from "@/lib/utils";
import type { EntryWithTags } from "@/lib/types";
import { useEntries, useMe, useSemanticSearch, useToday } from "@/lib/query/hooks";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-state";
import { EntryFilters } from "@/components/entries/entry-filters";
import { EntryCard } from "@/components/entries/entry-card";

/** 목록 화면 기준 최대 표시 개수 (기존 서버 렌더와 동일) */
const LIST_LIMIT = 300;

function rangeFrom(range: string, today: string) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;
  return days ? todayKey(subDays(parseISO(today), days - 1)) : undefined;
}

export function EntriesView() {
  const sp = useSearchParams();
  const today = useToday();
  const entries = useEntries();
  const me = useMe();
  const aiAvailable = me.data?.aiAvailable ?? true;

  const q = sp.get("q")?.trim() ?? "";
  const emotion = sp.get("emotion") ?? "";
  const event = sp.get("event") ?? "";
  const range = sp.get("range") ?? "all"; // 7d | 30d | 90d | all
  const semantic = sp.get("semantic") === "1";
  const wantSemantic = semantic && !!q && aiAvailable;

  // 의미 검색은 순서(id)만 받아 오고, 본문은 이미 받아 둔 기록 캐시에서 꺼내 쓴다
  const search = useSemanticSearch(q, wantSemantic);

  const semanticNote =
    semantic && q && me.data && !aiAvailable
      ? "OPENAI_API_KEY 가 없어 키워드 검색으로 대체했습니다."
      : wantSemantic && search.isError
        ? "의미 검색에 실패해 키워드 검색으로 대체했습니다."
        : null;
  const useSemanticResult = wantSemantic && !search.isError;

  const list = React.useMemo<EntryWithTags[] | null>(() => {
    if (!entries.data || !today) return null;
    const from = rangeFrom(range, today);
    let out: EntryWithTags[];
    if (useSemanticResult) {
      if (!search.data) return null;
      const byId = new Map(entries.data.map((e) => [e.id, e]));
      out = search.data
        .map((r) => byId.get(r.entry_id))
        .filter((e): e is EntryWithTags => !!e && (!from || e.entry_date >= from));
    } else {
      out = entries.data.filter((e) => !from || e.entry_date >= from).slice(0, LIST_LIMIT);
      if (q) {
        const needle = q.toLowerCase();
        out = out.filter(
          (e) =>
            e.content.toLowerCase().includes(needle) ||
            e.entry_tags.some((t) => t.value.toLowerCase().includes(needle)),
        );
      }
    }
    if (emotion) out = out.filter((e) => e.entry_tags.some((t) => t.kind === "emotion" && t.value === emotion));
    if (event) out = out.filter((e) => e.entry_tags.some((t) => t.kind === "event" && t.value === event));
    return out;
  }, [entries.data, today, range, useSemanticResult, search.data, q, emotion, event]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="기록 목록"
        description="태그·기간·키워드로 과거를 다시 봅니다. 의미 검색은 “불안했던 날”처럼 문장으로."
      />
      <EntryFilters
        key={sp.toString()}
        initial={{ q, emotion, event, range, semantic }}
        aiAvailable={aiAvailable}
      />
      {semanticNote && <p className="text-caption text-warning">{semanticNote}</p>}

      {entries.isError ? (
        <QueryError error={entries.error} onRetry={() => void entries.refetch()} />
      ) : !list ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="조건에 맞는 기록이 없습니다"
          description="필터를 줄이거나 다른 말로 검색해 보세요."
          action={<ButtonLink href="/entries">필터 초기화</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-caption text-subtle">
            {list.length}건{useSemanticResult ? " · 의미 유사도 순" : ""}
          </p>
          <ul className="space-y-3">
            {list.map((e) => (
              <li key={e.id}>
                <EntryCard entry={e} today={today!} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
