"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X } from "lucide-react";
import { EMOTIONS, EVENT_TYPES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, EmotionChip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";

interface Filters {
  q: string;
  emotion: string;
  event: string;
  range: string;
  semantic: boolean;
}

export function EntryFilters({
  initial,
  aiAvailable,
}: {
  initial: Filters;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<Filters>(initial);

  function apply(next: Filters) {
    setF(next);
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", next.q);
    if (next.emotion) sp.set("emotion", next.emotion);
    if (next.event) sp.set("event", next.event);
    if (next.range !== "all") sp.set("range", next.range);
    if (next.semantic) sp.set("semantic", "1");
    router.push(`/entries${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  }

  const hasAny = f.q || f.emotion || f.event || f.range !== "all";

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(f);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value })}
            placeholder={f.semantic ? "예: 불안했던 날, 일이 잘 풀렸던 순간" : "키워드 검색"}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          검색
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={f.range}
          onChange={(v) => apply({ ...f, range: v })}
          options={[
            { value: "7d", label: "7일" },
            { value: "30d", label: "30일" },
            { value: "90d", label: "90일" },
            { value: "all", label: "전체" },
          ]}
        />
        <Chip
          size="sm"
          selected={f.semantic}
          onClick={() => aiAvailable && apply({ ...f, semantic: !f.semantic })}
          title={aiAvailable ? "문장의 의미로 검색" : "OPENAI_API_KEY 필요"}
          className={!aiAvailable ? "opacity-50" : ""}
        >
          <Sparkles className="size-3.5" /> 의미 검색
        </Chip>
        {hasAny && (
          <button
            type="button"
            onClick={() => apply({ q: "", emotion: "", event: "", range: "all", semantic: f.semantic })}
            className="inline-flex items-center gap-1 text-caption text-muted hover:text-foreground"
          >
            <X className="size-3.5" /> 초기화
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EMOTIONS.map((m) => (
          <EmotionChip
            key={m}
            emotion={m}
            size="sm"
            selected={f.emotion === m}
            onClick={() => apply({ ...f, emotion: f.emotion === m ? "" : m })}
          />
        ))}
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
        {EVENT_TYPES.map((ev) => (
          <Chip
            key={ev}
            size="sm"
            selected={f.event === ev}
            onClick={() => apply({ ...f, event: f.event === ev ? "" : ev })}
          >
            {ev}
          </Chip>
        ))}
      </div>
    </div>
  );
}
