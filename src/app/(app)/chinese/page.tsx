import type { Metadata } from "next";
import { ChineseView } from "@/components/views/chinese-view";

export const metadata: Metadata = { title: "중국어" };

export default function ChinesePage() {
  return <ChineseView />;
}
