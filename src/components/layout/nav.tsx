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
  PanelLeftClose,
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
/** 가장자리에 스치기만 해도 열리지 않게 */
const OPEN_DELAY = 90;

/**
 * 데스크톱 사이드바.
 * - 로고를 누르면 고정(펼쳐 둠), 고정된 상태에서 로고를 누르면 숨김
 * - 숨긴 뒤엔 왼쪽 가장자리에 마우스를 대면 잠시 나타났다가, 벗어나면 들어간다
 */
export function Sidebar() {
  const pinned = React.useSyncExternalStore(subscribePinned, readPinned, () => false);
  const [peek, setPeek] = React.useState(false);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 방금 숨겼다면 마우스가 가장자리를 한 번 벗어날 때까지 다시 열지 않는다 */
  const suppress = React.useRef(false);
  const pathname = usePathname();

  const clear = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const show = React.useCallback(() => {
    if (suppress.current) return;
    clear();
    openTimer.current = setTimeout(() => setPeek(true), OPEN_DELAY);
  }, []);
  const keep = React.useCallback(() => {
    clear();
  }, []);
  const hide = React.useCallback(() => {
    clear();
    closeTimer.current = setTimeout(() => setPeek(false), CLOSE_DELAY);
  }, []);

  function toggleFromLogo() {
    clear();
    if (pinned) {
      suppress.current = true;
      setPeek(false);
      writePinned(false);
    } else {
      setPeek(false);
      writePinned(true);
    }
  }

  // 화면을 옮기면 잠깐 열린 사이드바는 접는다
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeek(false);
  }, [pathname]);
  React.useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPeek(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek]);
  React.useEffect(() => clear, []);

  const visible = pinned || peek;

  return (
    <>
      {/* 자리 잡기: 고정이면 사이드바 폭, 숨김이면 로고 자리만 */}
      <div
        aria-hidden
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block",
          pinned ? "w-60" : "w-20",
        )}
      />

      {/* 숨김 상태: 로고(누르면 고정) + 가장자리 감지 영역 */}
      {!pinned && (
        <div
          className="fixed inset-y-0 left-0 z-40 hidden w-20 md:block"
          onMouseEnter={show}
          onMouseLeave={() => {
            suppress.current = false;
            if (openTimer.current) clearTimeout(openTimer.current);
            if (peek) hide();
          }}
        >
          <button
            type="button"
            onClick={toggleFromLogo}
            aria-label="메뉴 펼쳐 두기"
            title="메뉴 펼쳐 두기"
            className="absolute left-6 top-6 rounded-[10px] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Logo />
          </button>
        </div>
      )}

      {/* 잠깐 열렸을 때 바깥을 누르면 닫힘 (터치용) */}
      {peek && !pinned && (
        <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setPeek(false)} aria-hidden />
      )}

      <aside
        onMouseEnter={pinned ? undefined : keep}
        onMouseLeave={pinned ? undefined : hide}
        onBlur={(e) => {
          if (!pinned && !e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
        }}
        inert={!visible}
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-border px-4 py-6 transition-[translate,opacity,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
          pinned ? "bg-surface/60 backdrop-blur" : "bg-surface/95 shadow-lg backdrop-blur-md",
          visible ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0",
        )}
      >
        <SidebarBody pinned={pinned} onLogo={toggleFromLogo} />
      </aside>
    </>
  );
}

function SidebarBody({ pinned, onLogo }: { pinned: boolean; onLogo: () => void }) {
  const pathname = usePathname();
  const prefetch = usePrefetchData();
  return (
    <>
      <div className="flex items-center gap-2">
        {/* 로고: 펼쳐 둠 ↔ 숨김 */}
        <button
          type="button"
          onClick={onLogo}
          aria-pressed={pinned}
          title={pinned ? "메뉴 숨기기" : "메뉴 펼쳐 두기"}
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <Logo className="transition-transform group-hover:scale-105" />
          <div className="leading-tight">
            <p className="text-heading font-semibold tracking-tight">Daily</p>
            <p className="text-micro text-subtle">나를 연구하는 기록</p>
          </div>
        </button>
        <button
          type="button"
          onClick={onLogo}
          aria-label={pinned ? "메뉴 숨기기" : "메뉴 펼쳐 두기"}
          title={pinned ? "숨기기 (왼쪽 끝에 마우스를 대면 잠시 나타나요)" : "펼쳐 두기"}
          className="rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          {pinned ? <PanelLeftClose className="size-4" /> : <Pin className="size-4" />}
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
