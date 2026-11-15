import type { Metadata } from "next";
import { requireUserPage } from "@/lib/supabase/server";
import { getSettings, fetchHabits, fetchHabitChecks, fetchEntries } from "@/lib/data";
import { todayKeySeoul } from "@/lib/utils";
import { WriteScreen } from "@/components/write/write-screen";
import { RecentEntries } from "@/components/write/recent-entries";
import { hasOpenAI } from "@/lib/openai";

export const metadata: Metadata = { title: "기록" };

export default async function WritePage() {
  const { supabase, user } = await requireUserPage();
  const today = todayKeySeoul();
  const [settings, habits, checks, recent] = await Promise.all([
    getSettings(supabase, user.id),
    fetchHabits(supabase, true),
    fetchHabitChecks(supabase, { from: today, to: today }),
    fetchEntries(supabase, { limit: 12 }),
  ]);

  return (
    <WriteScreen
      today={today}
      settings={settings}
      habits={habits}
      todayChecks={checks}
      aiAvailable={hasOpenAI()}
      recent={<RecentEntries entries={recent} today={today} />}
    />
  );
}
