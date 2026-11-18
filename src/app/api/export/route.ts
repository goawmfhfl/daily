import { handler, requireUser } from "@/lib/api-server";

/** GET /api/export — 내 데이터 전체를 JSON 으로 내려받기 */
export const GET = handler(async () => {
  const { supabase, user } = await requireUser();
  const [entries, tags, habits, checks, reports, evidence, zhPhrases, zhTranslations] = await Promise.all([
    supabase.from("entries").select("*").order("entry_date"),
    supabase.from("entry_tags").select("*"),
    supabase.from("habits").select("*"),
    supabase.from("habit_checks").select("*"),
    supabase.from("reports").select("*").order("created_at"),
    supabase.from("report_evidence").select("*"),
    supabase.from("zh_phrases").select("*").order("created_at"),
    supabase.from("zh_translations").select("*"),
  ]);
  const payload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    entries: entries.data ?? [],
    entry_tags: tags.data ?? [],
    habits: habits.data ?? [],
    habit_checks: checks.data ?? [],
    reports: reports.data ?? [],
    report_evidence: evidence.data ?? [],
    zh_phrases: zhPhrases.data ?? [],
    zh_translations: zhTranslations.data ?? [],
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="daily-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
