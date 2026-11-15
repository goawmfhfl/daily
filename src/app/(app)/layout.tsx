import { requireUserPage } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUserPage();
  return <AppShell wide>{children}</AppShell>;
}
