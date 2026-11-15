"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-caption font-medium text-danger">오류</p>
      <h1 className="mt-1 text-title font-semibold">문제가 생겼습니다</h1>
      <p className="mt-2 max-w-md text-body text-muted">{error.message}</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>다시 시도</Button>
        <ButtonLink href="/">기록으로</ButtonLink>
      </div>
    </div>
  );
}
