"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMOTION_META, type Emotion } from "@/lib/constants";

export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  selected?: boolean;
  /** CSS color 값. 선택 시 dot/배경에 사용 */
  color?: string;
  onRemove?: () => void;
  size?: "sm" | "md";
  /** AI가 제안한 값임을 표시 */
  ai?: boolean;
}

export function Chip({
  selected = false,
  color,
  onRemove,
  size = "md",
  ai,
  className,
  children,
  ...props
}: ChipProps) {
  const interactive = Boolean(props.onClick);
  const style = color
    ? ({
        "--chip": color,
      } as React.CSSProperties)
    : undefined;
  return (
    <button
      type="button"
      aria-pressed={interactive ? selected : undefined}
      style={style}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border font-medium transition-[background-color,border-color,color] select-none",
        size === "sm" ? "h-7 px-2.5 text-caption" : "h-8 px-3 text-caption",
        selected
          ? color
            ? "border-transparent bg-[color-mix(in_oklab,var(--chip)_18%,transparent)] text-foreground"
            : "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted",
        interactive && !selected && "hover:border-border-strong hover:text-foreground",
        !interactive && "cursor-default",
        className,
      )}
      {...props}
    >
      {color && (
        <span
          className="size-2 rounded-full"
          style={{ background: "var(--chip)" }}
          aria-hidden
        />
      )}
      {children}
      {ai && (
        <span
          className="ml-0.5 rounded-sm bg-accent-soft px-1 text-micro font-semibold text-accent"
          title="AI 제안"
        >
          AI
        </span>
      )}
      {selected && interactive && !onRemove && (
        <Check className="size-3.5 opacity-70" />
      )}
      {onRemove && (
        <span
          role="button"
          aria-label="제거"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 rounded-full p-0.5 opacity-60 hover:bg-foreground/10 hover:opacity-100"
        >
          <X className="size-3" />
        </span>
      )}
    </button>
  );
}

export function EmotionChip({
  emotion,
  ...props
}: Omit<ChipProps, "color" | "children"> & { emotion: string }) {
  const meta = EMOTION_META[emotion as Emotion];
  return (
    <Chip color={meta?.color ?? "var(--fg-subtle)"} {...props}>
      {emotion}
    </Chip>
  );
}

export function EmotionDot({
  emotion,
  className,
}: {
  emotion: string;
  className?: string;
}) {
  const meta = EMOTION_META[emotion as Emotion];
  return (
    <span
      className={cn("inline-block size-2.5 rounded-full", className)}
      style={{ background: meta?.color ?? "var(--fg-subtle)" }}
      aria-hidden
    />
  );
}
