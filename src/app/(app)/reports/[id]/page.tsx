import type { Metadata } from "next";
import { ReportDetailView } from "@/components/views/report-detail-view";

export const metadata: Metadata = { title: "리포트" };

// 화면 틀은 id 와 무관하므로 정적으로 만들고, 내용은 캐시(없으면 API)에서 가져온다
export const dynamic = "force-static";

export default async function ReportDetailPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  return <ReportDetailView id={id} />;
}
