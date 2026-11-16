"use client";

import * as React from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ApiError } from "@/lib/api";

/** 세션이 만료되면 어떤 요청이든 401 → 로그인 화면으로 */
function onAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    // 이전 사용자 캐시가 남지 않도록 클라이언트 이동이 아닌 전체 새로고침으로 보낸다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onAuthError }),
    mutationCache: new MutationCache({ onError: onAuthError }),
    defaultOptions: {
      queries: {
        // 이 앱의 데이터는 내가 바꿀 때만 바뀐다. 바꾸는 쪽(mutation)이 캐시를 직접 갱신하므로
        // 탭을 오갈 때는 다시 요청하지 않고, 5분이 지난 뒤 창으로 돌아올 때만 조용히 새로 받는다.
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
