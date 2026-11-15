import Link from "next/link";
import { MessageCircle, ShieldAlert } from "lucide-react";
import type { EntryWithTags } from "@/lib/types";
import { formatDateKo, relativeDayLabel, truncate } from "@/lib/utils";
import { EMOTION_META, type Emotion } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export function EntryCard({
  entry,
  today,
  compact,
}: {
  entry: EntryWithTags;
  today: string;
  compact?: boolean;
}) {
  const tags = entry.entry_tags;
  const emotions = tags.filter((t) => t.kind === "emotion").map((t) => t.value);
  const events = tags.filter((t) => t.kind === "event").map((t) => t.value);
  const intensity = tags.find((t) => t.kind === "intensity")?.value;
  const stressor = tags.find((t) => t.kind === "stressor")?.value;
  const dominant = emotions[0] as Emotion | undefined;
  const bar = dominant ? EMOTION_META[dominant].color : "var(--border-strong)";

  return (
    <Link
      href={`/entries/${entry.id}`}
      className="surface-card group relative block overflow-hidden px-5 py-4 transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-md"
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: bar }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-caption text-muted">
          <span className="font-medium text-foreground">
            {relativeDayLabel(entry.entry_date, today)}
          </span>
          <span className="text-subtle">{formatDateKo(entry.entry_date, "yyyy.MM.dd")}</span>
          {entry.mode === "dialogue" && (
            <MessageCircle className="size-3.5 text-subtle" aria-label="대화형" />
          )}
          {entry.risk_flag && (
            <ShieldAlert className="size-3.5 text-danger" aria-label="위기 표시" />
          )}
        </div>
        {intensity && (
          <span className="text-micro tabular text-subtle">강도 {intensity}</span>
        )}
      </div>
      <p className={compact ? "mt-1.5 line-clamp-2 text-caption" : "mt-2 line-clamp-3 text-body leading-relaxed text-foreground/90"}>
        {truncate(entry.content, compact ? 120 : 260)}
      </p>
      {(emotions.length > 0 || events.length > 0 || stressor) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {emotions.map((m) => (
            <Badge key={m} className="gap-1.5 bg-surface-2 text-foreground/80">
              <span
                className="size-1.5 rounded-full"
                style={{ background: EMOTION_META[m as Emotion]?.color }}
              />
              {m}
            </Badge>
          ))}
          {events.map((ev) => (
            <Badge key={ev}>{ev}</Badge>
          ))}
          {stressor && <Badge tone="warning">{stressor}</Badge>}
        </div>
      )}
    </Link>
  );
}
