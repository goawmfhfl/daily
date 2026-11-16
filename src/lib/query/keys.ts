/**
 * React Query 키.
 *
 * 화면마다 따로 요청하지 않고, 리소스별로 "한 번 받아 모든 화면이 나눠 쓰는" 구조입니다.
 * - entries: 전체 기록(태그 포함). 대시보드·타임라인·목록·최근 기록·리포트 기간별 개수가 모두 여기서 파생
 * - reports: 리포트 목록(본문 포함). 상세·대시보드 최신 리포트·타임라인 변화 구간이 여기서 파생
 * - habitChecks: 최근 30일 체크. 기록 화면의 "오늘" 체크도 여기서 파생
 */
export const qk = {
  me: ["me"] as const,
  settings: ["settings"] as const,
  entries: ["entries"] as const,
  entry: (id: string) => ["entries", "detail", id] as const,
  semantic: (q: string) => ["entries", "semantic", q] as const,
  habits: ["habits"] as const,
  habitChecks: (from: string, to: string) => ["habit-checks", from, to] as const,
  reports: ["reports"] as const,
  report: (id: string) => ["reports", "detail", id] as const,
};
