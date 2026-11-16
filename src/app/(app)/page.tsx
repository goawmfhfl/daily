import type { Metadata } from "next";
import { WriteView } from "@/components/views/write-view";

export const metadata: Metadata = { title: "기록" };

export default function WritePage() {
  return <WriteView />;
}
