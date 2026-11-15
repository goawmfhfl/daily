import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daily — 나를 연구하는 기록",
    short_name: "Daily",
    description: "매일의 기록을 AI가 분석해 나를 이해하는 개인 데이터 서비스",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#1b1a17",
    lang: "ko",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
