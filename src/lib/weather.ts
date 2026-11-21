/** 날씨 응답 (서버 → 화면) */
export interface WeatherNow {
  location: string;
  /** 관측 시각 (Asia/Seoul, yyyy-MM-ddTHH:mm) */
  time: string;
  temperature: number;
  apparent: number;
  humidity: number;
  windKmh: number;
  code: number;
  isDay: boolean;
  max: number | null;
  min: number | null;
  precipitationChance: number | null;
  pm10: number | null;
  pm25: number | null;
}

export type WeatherIcon =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud-moon"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

/** WMO 날씨 코드 → 한국어 설명과 아이콘 종류 */
export function describeWeather(code: number, isDay: boolean): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "맑음", icon: isDay ? "sun" : "moon" };
  if (code === 1) return { label: "대체로 맑음", icon: isDay ? "sun" : "moon" };
  if (code === 2) return { label: "구름 조금", icon: isDay ? "cloud-sun" : "cloud-moon" };
  if (code === 3) return { label: "흐림", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "안개", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "이슬비", icon: "drizzle" };
  if (code === 61 || code === 80) return { label: "약한 비", icon: "rain" };
  if (code === 63 || code === 81) return { label: "비", icon: "rain" };
  if (code === 65 || code === 82) return { label: "강한 비", icon: "rain" };
  if (code === 66 || code === 67) return { label: "어는 비", icon: "rain" };
  if (code === 71 || code === 85) return { label: "약한 눈", icon: "snow" };
  if (code === 73 || code === 75 || code === 77 || code === 86) return { label: "눈", icon: "snow" };
  if (code >= 95) return { label: "뇌우", icon: "storm" };
  return { label: "날씨 정보", icon: "cloud" };
}

export type AirGrade = "좋음" | "보통" | "나쁨" | "매우 나쁨";

/** 한국 환경부 기준으로 PM10·PM2.5 중 더 나쁜 등급 */
export function airGrade(pm10: number | null, pm25: number | null): AirGrade | null {
  const order: AirGrade[] = ["좋음", "보통", "나쁨", "매우 나쁨"];
  const g10 = pm10 == null ? -1 : pm10 <= 30 ? 0 : pm10 <= 80 ? 1 : pm10 <= 150 ? 2 : 3;
  const g25 = pm25 == null ? -1 : pm25 <= 15 ? 0 : pm25 <= 35 ? 1 : pm25 <= 75 ? 2 : 3;
  const g = Math.max(g10, g25);
  return g < 0 ? null : order[g];
}
