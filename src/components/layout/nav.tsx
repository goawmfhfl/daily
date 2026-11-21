"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenLine,
  LayoutDashboard,
  Activity,
  FileText,
  ListFilter,
  Languages,
  Settings,
  Pin,
  PinOff,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/query/hooks";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "기록", icon: PenLine },
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/timeline", label: "타임라인", icon: Activity },
  { href: "/reports", label: "리포트", icon: FileText },
  { href: "/entries", label: "기록 목록", icon: ListFilter },
  { href: "/chinese", label: "중국어", icon: Languages },
];

/** 메뉴에 손이 가는 순간(hover·focus·touch) 그 화면의 데이터를 미리 받아 둔다. 이미 캐시에 있으면 요청하지 않는다 */
function usePrefetchData() {
  const qc = useQueryClient();
  return (href: string) => {
    const run = () => prefetchRoute(qc, href);
    return { onMouseEnter: run, onFocus: run, onTouchStart: run };
  };
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/* 사이드바 고정 여부 (기기별 편의 설정). 기본은 숨김: 왼쪽 가장자리에 마우스를 대면 나타난다 */
const PIN_KEY = "daily:sidebar-pinned";
const pinListeners = new Set<() => void>();
function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}
function writePinned(v: boolean) {
  try {
    localStorage.setItem(PIN_KEY, v ? "1" : "0");
  } catch {}
  pinListeners.forEach((l) => l());
}
function subscribePinned(l: () => void) {
  pinListeners.add(l);
  return () => pinListeners.delete(l);
}

/** 마우스가 떠난 뒤 닫히기까지 (살짝 벗어나도 바로 닫히지 않게) */
const CLOSE_DELAY = 280;

export function Sidebar() {
  const pinned = React.useSyncExternalStore(subscribePinned, readPinned, () => false);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const show = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  }, []);
  const hide = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  // 화면을 옮기면 접는다
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (pinned) {
    return (
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 backdrop-blur md:flex">
        <SidebarBody pinned onTogglePin={() => writePinned(false)} />
      </aside>
    );
  }

  return (
    <>
      {/* 왼쪽 가장자리 감지 영역 + 손잡이 (터치 화면에선 눌러서 연다) */}
      <div
        className="group fixed inset-y-0 left-0 z-40 hidden w-3 md:block"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => (open ? setOpen(false) : show())}
          onFocus={show}
          className={cn(
            "absolute left-1 top-1/2 h-12 w-1 -translate-y-1/2 rounded-full bg-border-strong/70 transition-[opacity,background-color,height] duration-200 group-hover:h-16 group-hover:bg-accent",
            open && "opacity-0",
          )}
        />
      </div>

      {/* 열렸을 때 바깥을 누르면 닫힘 (터치용) */}
      {open && <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
        }}
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-border bg-surface/95 px-4 py-6 shadow-lg backdrop-blur-md transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
          open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0",
        )}
      >
        <SidebarBody pinned={false} onTogglePin={() => writePinned(true)} />
      </aside>
    </>
  );
}

function SidebarBody({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  const pathname = usePathname();
  const prefetch = usePrefetchData();
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
          <Logo />
          <div className="leading-tight">
            <p className="text-heading font-semibold tracking-tight">Daily</p>
            <p className="text-micro text-subtle">나를 연구하는 기록</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? "메뉴 자동 숨김" : "메뉴 고정"}
          title={pinned ? "자동으로 숨기기" : "항상 펼쳐 두기"}
          className="rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </button>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              {...prefetch(href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
                active
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-[18px]", active ? "text-accent" : "")}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/settings"
        {...prefetch("/settings")}
        aria-current={isActive(pathname, "/settings") ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
          isActive(pathname, "/settings")
            ? "bg-surface text-foreground shadow-sm"
            : "text-muted hover:bg-surface-2 hover:text-foreground",
        )}
      >
        <Settings className="size-[18px]" strokeWidth={1.8} />
        설정
      </Link>
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const prefetch = usePrefetchData();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur safe-bottom md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                {...prefetch(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-micro font-medium transition-colors",
                  active ? "text-accent" : "text-subtle hover:text-foreground",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileTopBar({ title }: { title?: string }) {
  return (
    <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Logo className="size-6" />
        <span className="text-body font-semibold">{title ?? "Daily"}</span>
      </Link>
      <Link
        href="/settings"
        aria-label="설정"
        className="rounded-md p-2 text-muted hover:text-foreground"
      >
        <Settings className="size-5" strokeWidth={1.8} />
      </Link>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="2.6" fill="var(--accent)" />
      </svg>
    </span>
  );
}
