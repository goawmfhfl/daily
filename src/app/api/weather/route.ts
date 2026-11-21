import { handler, requireUser, json, fail } from "@/lib/api-server";
import { WEATHER_LOCATION } from "@/lib/constants";
import type { WeatherNow } from "@/lib/weather";

/**
 * GET /api/weather — 고양시 현재 날씨와 오늘 최고·최저, 미세먼지.
 * Open-Meteo(키 불필요)를 쓰고, 응답은 10분 동안 서버에서 재사용한다.
 */
const REVALIDATE = 600;

export const GET = handler(async () => {
  await requireUser();
  const { latitude, longitude, name } = WEATHER_LOCATION;
  const base = `latitude=${latitude}&longitude=${longitude}&timezone=Asia%2FSeoul`;

  const [wRes, aRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?${base}&forecast_days=1` +
        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      { next: { revalidate: REVALIDATE } },
    ),
    // 미세먼지는 없어도 날씨는 보여 준다
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${base}&current=pm10,pm2_5`, {
      next: { revalidate: REVALIDATE },
    }).catch(() => null),
  ]);
  if (!wRes.ok) return fail("날씨를 불러오지 못했습니다.", 502);

  const w = await wRes.json();
  const a = aRes?.ok ? await aRes.json().catch(() => null) : null;
  const round = (n: unknown) => (typeof n === "number" ? Math.round(n * 10) / 10 : null);

  const weather: WeatherNow = {
    location: name,
    time: w.current?.time ?? "",
    temperature: round(w.current?.temperature_2m) ?? 0,
    apparent: round(w.current?.apparent_temperature) ?? 0,
    humidity: Math.round(w.current?.relative_humidity_2m ?? 0),
    windKmh: Math.round(w.current?.wind_speed_10m ?? 0),
    code: w.current?.weather_code ?? -1,
    isDay: w.current?.is_day === 1,
    max: round(w.daily?.temperature_2m_max?.[0]),
    min: round(w.daily?.temperature_2m_min?.[0]),
    precipitationChance: w.daily?.precipitation_probability_max?.[0] ?? null,
    pm10: round(a?.current?.pm10),
    pm25: round(a?.current?.pm2_5),
  };
  return json({ weather });
});
