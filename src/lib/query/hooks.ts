"use client";

import * as React from "react";
import { parseISO, subDays } from "date-fns";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayKey } from "@/lib/utils";
import type { AiMode, PeriodKey, UserSettings } from "@/lib/constants";
import type {
  EntryRow,
  EntryTagRow,
  EntryWithTags,
  HabitCheckRow,
  HabitRow,
  ReportRow,
  TagSuggestion,
  BriefResponse,
} from "@/lib/types";
import type { ConfirmedTag } from "@/components/write/tag-confirm";
import { qk } from "./keys";

/* ───────────────────────── 오늘 날짜 ───────────────────────── */

const noopSubscribe = () => () => {};

/** 기기 기준 오늘(yyyy-MM-dd). 정적 HTML 단계에서는 null */
export function useToday(): string | null {
  return React.useSyncExternalStore(noopSubscribe, () => todayKey(), () => null);
}

/** 체크 기록은 최근 30일을 한 번에 받아 대시보드·기록 화면이 함께 쓴다 */
export function checksWindow(today: string) {
  return { from: todayKey(subDays(parseISO(today), 29)), to: today };
}

/* ───────────────────────── 조회 함수 ───────────────────────── */

export interface Me {
  id: string;
  email: string | null;
  aiAvailable: boolean;
  models: { fast: string; report: string; embedding: string };
}

const fetchers = {
  me: () => api<Me>("/api/me"),
  settings: () => api<{ settings: UserSettings }>("/api/settings").then((r) => r.settings),
  entries: () => api<{ entries: EntryWithTags[] }>("/api/entries").then((r) => r.entries),
  entry: (id: string) => api<{ entry: EntryWithTags }>(`/api/entries/${id}`).then((r) => r.entry),
  habits: () => api<{ habits: HabitRow[] }>("/api/habits").then((r) => r.habits),
  habitChecks: (from: string, to: string) =>
    api<{ checks: HabitCheckRow[] }>(
      `/api/habit-checks?from=${from}&to=${to}`,
    ).then((r) => r.checks),
  reports: () => api<{ reports: ReportRow[] }>("/api/reports").then((r) => r.reports),
  report: (id: string) => api<{ report: ReportRow }>(`/api/reports/${id}`).then((r) => r.report),
  semantic: (q: string) =>
    api<{ results: { entry_id: string; similarity: number }[] }>("/api/search", {
      method: "POST",
      body: { q },
    }).then((r) => r.results),
};

/* ───────────────────────── 쿼리 훅 ───────────────────────── */

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: fetchers.me, staleTime: Infinity });
}

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: fetchers.settings });
}

export function useEntries() {
  return useQuery({ queryKey: qk.entries, queryFn: fetchers.entries });
}

/** 상세: 목록 캐시에 있으면 추가 요청 없이 바로 그린다 */
export function useEntry(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.entry(id),
    queryFn: () => fetchers.entry(id),
    initialData: () => qc.getQueryData<EntryWithTags[]>(qk.entries)?.find((e) => e.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.entries)?.dataUpdatedAt,
  });
}

export function useHabits() {
  return useQuery({ queryKey: qk.habits, queryFn: fetchers.habits });
}

export function useHabitChecks(today: string | null) {
  const w = today ? checksWindow(today) : null;
  return useQuery({
    queryKey: qk.habitChecks(w?.from ?? "", w?.to ?? ""),
    queryFn: () => fetchers.habitChecks(w!.from, w!.to),
    enabled: !!w,
  });
}

export function useReports() {
  return useQuery({ queryKey: qk.reports, queryFn: fetchers.reports });
}

export function useReport(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.report(id),
    queryFn: () => fetchers.report(id),
    initialData: () => qc.getQueryData<ReportRow[]>(qk.reports)?.find((r) => r.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.reports)?.dataUpdatedAt,
  });
}

/** 의미 검색: 같은 문장은 다시 임베딩하지 않도록 길게 캐시 */
export function useSemanticSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.semantic(q),
    queryFn: () => fetchers.semantic(q),
    enabled: enabled && q.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

/**
 * 어제의 나: 필요할 때(자동 표시 대상이거나 버튼을 눌렀을 때)만 받는다.
 * 서버가 하루 한 번 만들어 저장해 두므로, 다시 받아도 AI 를 또 부르지 않는다
 */
export function useDailyBrief(today: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.brief(today ?? ""),
    queryFn: () => api<BriefResponse>(`/api/briefs?today=${today}`),
    enabled: enabled && !!today,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** 지난 기록이 바뀌면 브리핑도 다시 확인하게 */
function staleBrief(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["brief"], refetchType: "none" });
}

/* ───────────────────────── 탭 이동 전 미리 받기 ───────────────────────── */

/** 메뉴에 마우스를 올리거나 터치하는 순간 그 화면에 필요한 데이터만 미리 받는다 */
export function prefetchRoute(qc: QueryClient, href: string) {
  const today = todayKey();
  const w = checksWindow(today);
  const p = <T,>(queryKey: readonly unknown[], queryFn: () => Promise<T>) =>
    void qc.prefetchQuery({ queryKey, queryFn });

  switch (href) {
    case "/":
      p(qk.settings, fetchers.settings);
      p(qk.habits, fetchers.habits);
      p(qk.habitChecks(w.from, w.to), () => fetchers.habitChecks(w.from, w.to));
      p(qk.entries, fetchers.entries);
      p(qk.me, fetchers.me);
      break;
    case "/dashboard":
      p(qk.entries, fetchers.entries);
      p(qk.habits, fetchers.habits);
      p(qk.habitChecks(w.from, w.to), () => fetchers.habitChecks(w.from, w.to));
      p(qk.reports, fetchers.reports);
      break;
    case "/timeline":
      p(qk.entries, fetchers.entries);
      p(qk.reports, fetchers.reports);
      break;
    case "/reports":
      p(qk.entries, fetchers.entries);
      p(qk.reports, fetchers.reports);
      p(qk.me, fetchers.me);
      break;
    case "/entries":
      p(qk.entries, fetchers.entries);
      p(qk.me, fetchers.me);
      break;
    case "/settings":
      p(qk.settings, fetchers.settings);
      p(qk.habits, fetchers.habits);
      p(qk.me, fetchers.me);
      break;
  }
}

/* ───────────────────────── 캐시 갱신 도우미 ───────────────────────── */

function sortEntries(list: EntryWithTags[]) {
  return [...list].sort((a, b) =>
    a.entry_date !== b.entry_date
      ? a.entry_date < b.entry_date ? 1 : -1
      : a.created_at < b.created_at ? 1 : -1,
  );
}

/** 목록 캐시와 상세 캐시를 함께 갱신 */
function upsertEntry(qc: QueryClient, entry: EntryWithTags) {
  qc.setQueryData<EntryWithTags[]>(qk.entries, (list) =>
    list ? sortEntries([entry, ...list.filter((e) => e.id !== entry.id)]) : list,
  );
  qc.setQueryData(qk.entry(entry.id), entry);
}

function patchEntry(qc: QueryClient, id: string, patch: (e: EntryWithTags) => EntryWithTags) {
  const list = qc.getQueryData<EntryWithTags[]>(qk.entries);
  const current = qc.getQueryData<EntryWithTags>(qk.entry(id)) ?? list?.find((e) => e.id === id);
  if (current) upsertEntry(qc, patch(current));
}

/* ───────────────────────── 기록 ───────────────────────── */

export interface SaveEntryResponse {
  entry: EntryWithTags;
  crisis: boolean;
  suggestion: TagSuggestion | null;
  ai_error?: string | null;
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      content: string;
      mode: "free" | "dialogue";
      entry_date: string;
      ai_mode: AiMode;
    }) => api<SaveEntryResponse>("/api/entries", { method: "POST", body }),
    onSuccess: (res) => upsertEntry(qc, res.entry),
  });
}

export function useUpdateEntry(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; entry_date: string }) =>
      api<{ entry: EntryRow }>(`/api/entries/${id}`, { method: "PATCH", body }),
    onSuccess: ({ entry }) => patchEntry(qc, id, (e) => ({ ...e, ...entry })),
    // 내용이 바뀌면 의미 검색 결과(임베딩)도 달라지므로 다음 검색 때 다시 받는다
    onSettled: () => {
      staleBrief(qc);
      return qc.invalidateQueries({ queryKey: ["entries", "semantic"], refetchType: "none" });
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/entries/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.setQueryData<EntryWithTags[]>(qk.entries, (list) => list?.filter((e) => e.id !== id));
      // 보고 있던 상세 화면이 깜빡이지 않도록 지우지 않고 "오래됨"으로만 표시 (다시 열면 새로 확인)
      void qc.invalidateQueries({ queryKey: qk.entry(id), refetchType: "none" });
      staleBrief(qc);
    },
  });
}

export function useSaveTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: ConfirmedTag[] }) =>
      api<{ tags: EntryTagRow[] }>(`/api/entries/${id}/tags`, { method: "PUT", body: { tags } }),
    onSuccess: ({ tags }, { id }) => patchEntry(qc, id, (e) => ({ ...e, entry_tags: tags })),
    onSettled: () => staleBrief(qc),
  });
}

/* ───────────────────────── 지속 활동 ───────────────────────── */

export function useToggleHabitCheck(today: string | null) {
  const qc = useQueryClient();
  const w = today ? checksWindow(today) : null;
  const key = qk.habitChecks(w?.from ?? "", w?.to ?? "");
  return useMutation({
    mutationFn: (body: { habit_id: string; entry_date: string; done: boolean }) =>
      api("/api/habit-checks", { method: "PUT", body }),
    // 누르는 즉시 반영하고, 실패하면 되돌린다
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<HabitCheckRow[]>(key);
      qc.setQueryData<HabitCheckRow[]>(key, (list = []) => {
        const rest = list.filter(
          (c) => !(c.habit_id === body.habit_id && c.entry_date === body.entry_date),
        );
        const existing = list.find(
          (c) => c.habit_id === body.habit_id && c.entry_date === body.entry_date,
        );
        return [
          ...rest,
          {
            id: existing?.id ?? `optimistic-${body.habit_id}-${body.entry_date}`,
            user_id: existing?.user_id ?? "",
            ...body,
          },
        ];
      });
      return { prev };
    },
    onError: (_e, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ habit: HabitRow }>("/api/habits", { method: "POST", body: { name } }),
    onSuccess: ({ habit }) =>
      qc.setQueryData<HabitRow[]>(qk.habits, (list) => (list ? [...list, habit] : list)),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      active?: boolean;
      name?: string;
      started_at?: string;
    }) =>
      api<{ habit: HabitRow }>(`/api/habits/${id}`, { method: "PATCH", body }),
    onSuccess: ({ habit }) =>
      qc.setQueryData<HabitRow[]>(qk.habits, (list) =>
        list?.map((h) => (h.id === habit.id ? habit : h)),
      ),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/habits/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.setQueryData<HabitRow[]>(qk.habits, (list) => list?.filter((h) => h.id !== id));
      // 체크 기록도 함께 삭제(cascade)되므로 캐시에서도 제거
      qc.setQueriesData<HabitCheckRow[]>({ queryKey: ["habit-checks"] }, (list) =>
        list?.filter((c) => c.habit_id !== id),
      );
    },
  });
}

/* ───────────────────────── 설정 ───────────────────────── */

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) =>
      api<{ settings: UserSettings }>("/api/settings", { method: "PATCH", body: patch }),
    onSuccess: ({ settings }) => qc.setQueryData(qk.settings, settings),
  });
}

export function useWipeAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/account", { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData(qk.entries, []);
      qc.setQueryData(qk.reports, []);
      qc.setQueryData(qk.habits, []);
      qc.setQueriesData({ queryKey: ["habit-checks"] }, []);
      qc.removeQueries({ queryKey: ["entries", "detail"] });
      qc.removeQueries({ queryKey: ["entries", "semantic"] });
      qc.removeQueries({ queryKey: ["reports", "detail"] });
      qc.removeQueries({ queryKey: ["brief"] });
    },
  });
}

/* ───────────────────────── 리포트 ───────────────────────── */

export type GenerateReportResponse =
  | { insufficient: true; message: string; count: number; required: number }
  | { insufficient: false; report: ReportRow };

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { period_key: PeriodKey; today: string }) =>
      api<GenerateReportResponse>("/api/reports", { method: "POST", body }),
    onSuccess: (res) => {
      if (res.insufficient) return;
      qc.setQueryData<ReportRow[]>(qk.reports, (list) =>
        list ? [res.report, ...list.filter((r) => r.id !== res.report.id)] : list,
      );
      qc.setQueryData(qk.report(res.report.id), res.report);
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/reports/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.setQueryData<ReportRow[]>(qk.reports, (list) => list?.filter((r) => r.id !== id));
      void qc.invalidateQueries({ queryKey: qk.report(id), refetchType: "none" });
    },
  });
}
