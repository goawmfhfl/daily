import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/constants";
import type {
  EntryWithTags,
  HabitRow,
  HabitCheckRow,
  ReportRow,
} from "@/lib/types";

export async function getSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettings> {
  const { data } = await supabase
    .from("profiles")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  return { ...DEFAULT_SETTINGS, ...((data?.settings as Partial<UserSettings>) ?? {}) };
}

export async function saveSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<UserSettings>,
) {
  const current = await getSettings(supabase, userId);
  const next = { ...current, ...patch };
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, settings: next }, { onConflict: "user_id" });
  if (error) throw error;
  return next;
}

export async function fetchEntries(
  supabase: SupabaseClient,
  opts: {
    from?: string;
    to?: string;
    limit?: number;
    ascending?: boolean;
    ids?: string[];
  } = {},
): Promise<EntryWithTags[]> {
  let q = supabase
    .from("entries")
    .select("*, entry_tags(*)")
    .order("entry_date", { ascending: opts.ascending ?? false })
    .order("created_at", { ascending: opts.ascending ?? false });
  if (opts.from) q = q.gte("entry_date", opts.from);
  if (opts.to) q = q.lte("entry_date", opts.to);
  if (opts.ids) q = q.in("id", opts.ids);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as EntryWithTags[];
}

export async function fetchEntry(
  supabase: SupabaseClient,
  id: string,
): Promise<EntryWithTags | null> {
  const { data } = await supabase
    .from("entries")
    .select("*, entry_tags(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as EntryWithTags) ?? null;
}

export async function fetchHabits(
  supabase: SupabaseClient,
  activeOnly = false,
): Promise<HabitRow[]> {
  let q = supabase.from("habits").select("*").order("created_at");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HabitRow[];
}

export async function fetchHabitChecks(
  supabase: SupabaseClient,
  opts: { from?: string; to?: string } = {},
): Promise<HabitCheckRow[]> {
  let q = supabase.from("habit_checks").select("*");
  if (opts.from) q = q.gte("entry_date", opts.from);
  if (opts.to) q = q.lte("entry_date", opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HabitCheckRow[];
}

export async function fetchReports(
  supabase: SupabaseClient,
  opts: { periodKey?: string; limit?: number } = {},
): Promise<ReportRow[]> {
  let q = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts.periodKey) q = q.eq("period_key", opts.periodKey);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

export async function fetchReport(
  supabase: SupabaseClient,
  id: string,
): Promise<ReportRow | null> {
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ReportRow) ?? null;
}

/** 특정 날짜의 모든 기록 날짜 키 (연속 기록일 계산용) */
export async function fetchEntryDates(
  supabase: SupabaseClient,
  limit = 400,
): Promise<string[]> {
  const { data } = await supabase
    .from("entries")
    .select("entry_date")
    .order("entry_date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => r.entry_date as string);
}
