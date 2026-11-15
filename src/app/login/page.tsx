import type { Metadata } from "next";
import { Logo } from "@/components/layout/nav";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-start gap-4">
          <Logo className="size-10 rounded-xl" />
          <div>
            <h1 className="text-title font-semibold tracking-tight">Daily</h1>
            <p className="mt-1 text-body text-muted">
              일기장이 아니라, 나를 연구하는 도구.
            </p>
          </div>
        </div>
        <LoginForm next={next} />
        <p className="mt-8 text-caption leading-relaxed text-subtle">
          이 앱은 혼자 쓰는 앱입니다. 모든 기록은 데이터베이스의 행 단위 보안으로
          본인만 읽을 수 있습니다.
        </p>
      </div>
    </div>
  );
}
