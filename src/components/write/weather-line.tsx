"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useWeather } from "@/lib/query/hooks";
import { airGrade, describeWeather, type WeatherIcon } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

const ICON_TONE: Partial<Record<WeatherIcon, string>> = {
  sun: "text-joy",
  "cloud-sun": "text-joy",
  rain: "text-sadness",
  drizzle: "text-sadness",
  storm: "text-anxiety",
  snow: "text-sadness",
};

const AIR_TONE = {
  좋음: "text-success",
  보통: "text-muted",
  나쁨: "text-warning",
  "매우 나쁨": "text-danger",
} as const;

const deg = (n: number | null) => (n == null ? "–" : `${Math.round(n)}°`);

/** 기록 화면 상단: 고양시 현재 날씨 한 줄 */
export function WeatherLine({ className }: { className?: string }) {
  const { data: w, isPending, isError } = useWeather();

  if (isPending) return <Skeleton className={cn("h-7 w-64", className)} />;
  if (isError || !w) return null;

  const { label, icon } = describeWeather(w.code, w.isDay);
  const Icon = ICONS[icon];
  const air = airGrade(w.pm10, w.pm25);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}
      title={`${w.location} · ${w.time.replace("T", " ")} 기준`}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className={cn("size-6", ICON_TONE[icon] ?? "text-muted")} strokeWidth={1.8} />
        <span className="text-title font-semibold tabular tracking-tight">{deg(w.temperature)}</span>
        <span className="text-body text-foreground/85">{label}</span>
      </span>
      <span className="text-caption text-muted">
        {w.location} · 체감 {deg(w.apparent)} · 최고 {deg(w.max)} / 최저 {deg(w.min)}
        {w.precipitationChance != null && ` · 강수 ${w.precipitationChance}%`}
        {air && (
          <>
            {" · 미세먼지 "}
            <span className={cn("font-medium", AIR_TONE[air])}>{air}</span>
          </>
        )}
      </span>
    </div>
  );
}
