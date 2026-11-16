import type { Metadata } from "next";
import { EntryDetailView } from "@/components/views/entry-detail-view";

export const metadata: Metadata = { title: "기록" };

// 화면 틀은 id 와 무관하므로 정적으로 만들고, 내용은 캐시(없으면 API)에서 가져온다
export const dynamic = "force-static";

export default async function EntryDetailPage({ params }: PageProps<"/entries/[id]">) {
  const { id } = await params;
  return <EntryDetailView id={id} />;
}
