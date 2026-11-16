import { AppShell } from "@/components/layout/app-shell";

/**
 * 로그인 확인은 proxy(src/proxy.ts)가, 데이터 접근 권한은 각 API 의 requireUser + RLS 가 맡는다.
 * 여기서 서버 인증을 하지 않아야 화면들이 정적으로 미리 만들어지고,
 * 탭을 누를 때 서버 왕복 없이 바로 전환된다. 데이터는 React Query 캐시에서 온다.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell wide>{children}</AppShell>;
}
