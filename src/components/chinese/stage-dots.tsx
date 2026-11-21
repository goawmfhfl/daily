import { cn } from "@/lib/utils";
import { MASTERED_STAGE, REVIEW_INTERVALS, intervalLabel } from "@/lib/zh-review";

/** 복습 사다리: 내일 → 3일 → 1주 → 2주 → 1달 → 3달. 지나온 칸을 채운다 */
export function StageDots({ stage, className }: { stage: number; className?: string }) {
  const mastered = stage >= MASTERED_STAGE;
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="img"
      aria-label={mastered ? "완전히 외움" : `복습 ${stage}/${REVIEW_INTERVALS.length}단계`}
    >
      {REVIEW_INTERVALS.map((d, i) => (
        <span
          key={d}
          title={intervalLabel(d)}
          className={cn(
            "size-1.5 rounded-full transition-colors",
            mastered ? "bg-primary" : i < stage ? "bg-success" : "bg-surface-3",
          )}
        />
      ))}
    </span>
  );
}
