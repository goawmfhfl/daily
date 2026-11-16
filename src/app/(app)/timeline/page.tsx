import type { Metadata } from "next";
import { TimelineView } from "@/components/views/timeline-view";

export const metadata: Metadata = { title: "타임라인" };

export default function TimelinePage() {
  return <TimelineView />;
}
