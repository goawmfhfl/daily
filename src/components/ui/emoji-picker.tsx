"use client";

import * as React from "react";
import { SmilePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 지속 활동에 어울리는 이모지 (운동·공부·생활·마음) */
export const HABIT_EMOJIS = [
  "🏃", "🚶", "🚴", "🏊", "💪", "🧘", "⚽", "🏸",
  "📚", "📖", "✍️", "📝", "💻", "🧠", "🗣️", "🇨🇳",
  "🎸", "🎹", "🎨", "📷", "🎧", "🎯", "🌱", "🧹",
  "💧", "🥗", "🍎", "☕", "😴", "🌅", "🌙", "💊",
  "🦷", "🧴", "🙏", "❤️", "💰", "🐶", "☀️", "✨",
] as const;

/**
 * 이모지 고르기: 버튼을 누르면 아래에 작은 판이 열린다.
 * 바깥을 누르거나 Esc 로 닫힌다.
 */
export function EmojiPicker({
  value,
  onChange,
  size = "md",
  className,
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(e: string | null) {
    onChange(e);
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={value ? `이모지 ${value} 바꾸기` : "이모지 고르기"}
        aria-expanded={open}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md transition-colors",
          size === "sm" ? "size-7 text-[1.05rem]" : "size-8 text-[1.15rem]",
          value ? "hover:bg-surface-3" : "text-subtle hover:bg-surface-2 hover:text-foreground",
          open && "bg-surface-3",
        )}
      >
        {value ?? <SmilePlus className="size-4" />}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="이모지 고르기"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-30 mt-1.5 w-[17.5rem] rounded-xl border border-border bg-surface p-2 shadow-lg animate-fade-in"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {HABIT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                aria-pressed={value === e}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-[1.15rem] transition-transform hover:scale-110 hover:bg-surface-2",
                  value === e && "bg-accent-soft",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-caption text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-3.5" /> 이모지 없애기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
