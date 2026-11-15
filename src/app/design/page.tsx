import type { Metadata } from "next";
import { DesignShowcase } from "@/components/design/design-showcase";

export const metadata: Metadata = { title: "디자인 시스템" };

export default function DesignPage() {
  return <DesignShowcase />;
}
