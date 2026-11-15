import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모든 화면이 로그인 사용자 기준의 동적 데이터이므로 Cache Components는 사용하지 않습니다.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
