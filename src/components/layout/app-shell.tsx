import * as React from "react";
import { Sidebar, BottomNav, MobileTopBar } from "./nav";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main
          className={cn(
            "mx-auto w-full flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-10",
            wide ? "max-w-[1400px]" : "max-w-5xl",
          )}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
