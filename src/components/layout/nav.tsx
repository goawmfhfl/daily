"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenLine,
  LayoutDashboard,
  Activity,
  FileText,
  ListFilter,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 backdrop-blur md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <Logo />
        <div className="leading-tight">
          <p className="text-heading font-semibold tracking-tight">Daily</p>
          <p className="text-micro text-subtle">나를 연구하는 기록</p>
        </div>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
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
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur safe-bottom md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
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
