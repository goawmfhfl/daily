import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3.5 text-body text-foreground placeholder:text-subtle shadow-sm transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    /** 내용이 넘치면 스크롤 대신 입력창 높이가 아래로 늘어난다 (min-h 는 className 으로) */
    autoResize?: boolean;
  }
>(({ className, autoResize, value, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current!);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    // 높이를 잠깐 auto 로 줄이면 페이지가 짧아져 브라우저가 스크롤을 위로 당긴다.
    // 화면이 튀지 않도록 스크롤 위치(창 + 스크롤되는 부모들)를 기억했다가 되돌린다
    const scrolled: [Element, number][] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.scrollTop > 0) scrolled.push([p, p.scrollTop]);
    }
    const root = document.scrollingElement;
    if (root && root.scrollTop > 0 && !scrolled.some(([n]) => n === root)) {
      scrolled.push([root, root.scrollTop]);
    }
    // 한 번 줄였다가 실제 내용 높이로 맞춘다 (지울 때도 줄어들도록)
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
    for (const [node, top] of scrolled) node.scrollTop = top;
  }, [autoResize]);

  // 값이 바뀔 때(입력·저장 후 비우기 모두)와 너비가 바뀌어 줄바꿈이 달라질 때 다시 맞춘다
  React.useLayoutEffect(resize, [resize, value]);
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el || !autoResize || typeof ResizeObserver === "undefined") return;
    let width = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== width) {
        width = el.offsetWidth;
        resize();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoResize, resize]);

  return (
    <textarea
      ref={innerRef}
      value={value}
      className={cn(
        fieldBase,
        "py-2.5 leading-relaxed",
        autoResize && "resize-none overflow-hidden",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(fieldBase, "h-10 appearance-none pr-9", className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-caption font-medium text-muted", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-caption text-subtle">{hint}</p>}
    </div>
  );
}
