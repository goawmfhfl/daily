"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,30rem)] rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-fade-up",
        className,
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-heading font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-caption text-muted">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="닫기"
            onClick={onClose}
            className="-mr-2 -mt-2"
          >
            <X className="size-4" />
          </Button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        {footer && (
          <div className="mt-6 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
