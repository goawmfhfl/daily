import type { Metadata } from "next";
import { ReportsView } from "@/components/views/reports-view";

export const metadata: Metadata = { title: "리포트" };

export default function ReportsPage() {
  return <ReportsView />;
}
