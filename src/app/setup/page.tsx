import type { Metadata } from "next";
import { Logo } from "@/components/layout/nav";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "설정 필요" };

const KEYS = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase 프로젝트 URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon(public) 키"],
  ["OPENAI_API_KEY", "OpenAI API 키 (태깅·응답·리포트·검색)"],
];

export default function SetupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Logo className="mb-6 size-10 rounded-xl" />
        <h1 className="text-title font-semibold tracking-tight">환경변수가 필요합니다</h1>
        <p className="mt-2 text-body text-muted">
          프로젝트 루트에 <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-caption">.env.local</code> 을 만들고 아래 값을 넣은 뒤 서버를 다시 시작하세요.
        </p>
        <div className="surface-card mt-6 divide-y divide-border">
          {KEYS.map(([k, d]) => (
            <div key={k} className="px-5 py-3.5">
              <p className="font-mono text-caption font-semibold">{k}</p>
              <p className="text-caption text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-caption text-subtle">
          데이터베이스 스키마는 <code className="font-mono">supabase/migrations/0001_init.sql</code> 을 Supabase SQL Editor 에서 실행하세요.
        </p>
        <div className="mt-6">
          <ButtonLink href="/design" variant="secondary">디자인 시스템 미리보기</ButtonLink>
        </div>
      </div>
    </div>
  );
}
