import type { Metadata } from "next";
import { subDays } from "date-fns";
import { Search } from "lucide-react";
import { requireUserPage } from "@/lib/supabase/server";
import { fetchEntries } from "@/lib/data";
import { todayKeySeoul } from "@/lib/utils";
import { embed, hasOpenAI } from "@/lib/openai";
import type { EntryWithTags } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { EntryFilters } from "@/components/entries/entry-filters";
import { EntryCard } from "@/components/entries/entry-card";

export const metadata: Metadata = { title: "기록 목록" };

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

export default async function EntriesPage({ searchParams }: PageProps<"/entries">) {
  const sp = await searchParams;
  const { supabase } = await requireUserPage();
  const today = todayKeySeoul();

  const q = str(sp.q)?.trim() ?? "";
  const emotion = str(sp.emotion);
  const event = str(sp.event);
  const range = str(sp.range) ?? "all"; // 7d | 30d | 90d | all
  const semantic = str(sp.semantic) === "1";

  const from =
    range === "7d"
      ? todayKeySeoul(subDays(new Date(today), 6))
      : range === "30d"
        ? todayKeySeoul(subDays(new Date(today), 29))
        : range === "90d"
          ? todayKeySeoul(subDays(new Date(today), 89))
          : undefined;

  let entries: EntryWithTags[] = [];
  let semanticNote: string | null = null;

  if (semantic && q) {
    if (!hasOpenAI()) {
      semanticNote = "OPENAI_API_KEY 가 없어 키워드 검색으로 대체했습니다.";
    } else {
      const vector = await embed(q);
      if (vector) {
        const { data } = await supabase.rpc("match_entries", {
          query_embedding: vector,
          match_count: 40,
        });
        const ids = ((data ?? []) as { entry_id: string }[]).map((r) => r.entry_id);
        if (ids.length) {
          const list = await fetchEntries(supabase, { ids, from });
          const order = new Map(ids.map((id, i) => [id, i]));
          list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
          entries = list;
        }
      } else {
        semanticNote = "임베딩 생성에 실패해 키워드 검색으로 대체했습니다.";
      }
    }
  }

  if (!(semantic && q) || semanticNote) {
    entries = await fetchEntries(supabase, { from, limit: 300 });
    if (q) {
      const needle = q.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.content.toLowerCase().includes(needle) ||
          e.entry_tags.some((t) => t.value.toLowerCase().includes(needle)),
      );
    }
  }

  if (emotion) {
    entries = entries.filter((e) =>
      e.entry_tags.some((t) => t.kind === "emotion" && t.value === emotion),
    );
  }
  if (event) {
    entries = entries.filter((e) =>
      e.entry_tags.some((t) => t.kind === "event" && t.value === event),
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="기록 목록"
        description="태그·기간·키워드로 과거를 다시 봅니다. 의미 검색은 “불안했던 날”처럼 문장으로."
      />
      <EntryFilters
        initial={{ q, emotion: emotion ?? "", event: event ?? "", range, semantic }}
        aiAvailable={hasOpenAI()}
      />
      {semanticNote && <p className="text-caption text-warning">{semanticNote}</p>}

      {entries.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="조건에 맞는 기록이 없습니다"
          description="필터를 줄이거나 다른 말로 검색해 보세요."
          action={<ButtonLink href="/entries">필터 초기화</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-caption text-subtle">
            {entries.length}건{semantic && q && !semanticNote ? " · 의미 유사도 순" : ""}
          </p>
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.id}>
                <EntryCard entry={e} today={today} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
