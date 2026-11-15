import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/supabase/server";
import { fetchEntry } from "@/lib/data";
import { EntryEditor } from "@/components/entries/entry-editor";

export const metadata: Metadata = { title: "기록" };

export default async function EntryDetailPage({ params }: PageProps<"/entries/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUserPage();
  const entry = await fetchEntry(supabase, id);
  if (!entry) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <EntryEditor entry={entry} />
    </div>
  );
}
