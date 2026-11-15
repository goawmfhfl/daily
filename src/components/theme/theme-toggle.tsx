"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";

type Theme = "light" | "dark" | "system";
const KEY = "daily:theme";
const EVENT = "daily:theme-change";

function read(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function applyTheme(v: Theme) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const t = v === "system" ? (dark ? "dark" : "light") : v;
  document.documentElement.setAttribute("data-theme", t);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function change(v: Theme) {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    applyTheme(v);
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <Segmented<Theme>
      value={theme}
      onChange={change}
      options={[
        { value: "light", label: "라이트", icon: <Sun className="size-4" /> },
        { value: "dark", label: "다크", icon: <Moon className="size-4" /> },
        {
          value: "system",
          label: "시스템",
          icon: <Monitor className="size-4" />,
        },
      ]}
    />
  );
}
