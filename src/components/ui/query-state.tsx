"use client";

import { AlertCircle, RotateCw } from "lucide-react";
import { Skeleton } from "./skeleton";
import { Button } from "./button";

/** 첫 방문에서 캐시가 비어 있을 때만 보이는 화면 골격 */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function QueryError({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry?: () => void;
}) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertCircle className="size-6 text-danger" />
      <div>
        <p className="text-body font-semibold">데이터를 불러오지 못했습니다</p>
        {error?.message && <p className="mt-1 text-caption text-muted">{error.message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> 다시 시도
        </Button>
      )}
    </div>
  );
}
